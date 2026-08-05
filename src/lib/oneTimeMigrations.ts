import { doc, getDoc, updateDoc, deleteField, collection, query, where, getDocs } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import { logAction } from './logger';

/**
 * MIGRACION TEMPORAL DE UNA SOLA VEZ — quitar despues de confirmar que el
 * expediente ya se restauro y el usuario lo confirmo en pantalla.
 *
 * El usuario elimino por accidente el expediente que agrupa sus 10
 * contrarecibos reales (trenHXXXa9nYzxB7Kxi5) y pidio explicitamente no
 * tener que abrir nada manualmente para recuperarlo. Esto revisa, una
 * sola vez por sesion (via localStorage, solo para evitar lecturas
 * repetidas — la comprobacion real siempre es contra Firestore, asi que
 * es inofensivo si corre mas de una vez), si ese documento especifico
 * sigue marcado como eliminado, y si es asi, lo restaura solo, sin que
 * nadie tenga que abrir el expediente ni tocar la Papelera.
 */
const MARCA = 'cb_migracion_restaurar_trenHXXX_v4';
const ID_EXPEDIENTE = 'trenHXXXa9nYzxB7Kxi5';
const KILOS_REALES = 23825.58;
const ID_COMPRA_71_14014 = 'VDMBcPv4zrwTOBtWQ07C';
// deuda real objetivo (-102,670.28) = 0 pagado - (23,825.58 + 2,964.16) kg
// x $42/kg + historicalDebtAndres -> despeja a este valor.
const HISTORICAL_DEBT_CORRECTO = 1022498.80;

export async function restaurarExpedienteAutomaticamente(userEmail: string | undefined | null) {
  if (typeof window === 'undefined' || !userEmail) return;
  if (localStorage.getItem(MARCA)) return;

  try {
    const ref = doc(db, PATHS.orders, ID_EXPEDIENTE);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data()?.isDeleted === true) {
      await updateDoc(ref, {
        isDeleted: deleteField(),
        deletedAt: deleteField(),
        deletedBy: deleteField(),
      });
      logAction(userEmail, 'Expediente Restaurado (Migracion Automatica)', { orderId: ID_EXPEDIENTE });
    }

    // El registro de compra asociado (mismo ID) tenia receivedKilos en 0
    // en vez de los 23,825.58 kg reales que Andres entrego -- por eso
    // "Material Flotante" salia negativo. Se corrige aqui tambien.
    const refCompra = doc(db, PATHS.purchases, ID_EXPEDIENTE);
    const snapCompra = await getDoc(refCompra);
    if (snapCompra.exists() && Number(snapCompra.data()?.receivedKilos || 0) !== KILOS_REALES) {
      await updateDoc(refCompra, { receivedKilos: KILOS_REALES });
      logAction(userEmail, 'Compra Corregida (Migracion Automatica)', { purchaseId: ID_EXPEDIENTE, receivedKilos: KILOS_REALES });
    }

    // El registro de compra de la OC 71/14014 seguia con proveedor
    // "N0342 - ELEMENTAL DENIM" (el nombre del propio negocio del
    // usuario, tomado del texto de la OC) en vez de "Andres" (quien
    // realmente entrega el material) -- por eso "Estado de Cuenta" en
    // Compras no contaba esos 2,964.16 kg como parte de la deuda real.
    const refCompra2 = doc(db, PATHS.purchases, ID_COMPRA_71_14014);
    const snapCompra2 = await getDoc(refCompra2);
    if (snapCompra2.exists() && snapCompra2.data()?.provider !== 'Andrés') {
      await updateDoc(refCompra2, { provider: 'Andrés' });
      logAction(userEmail, 'Proveedor Corregido (Migracion Automatica)', { purchaseId: ID_COMPRA_71_14014, provider: 'Andrés' });
    }

    // Se encontraron 6 movimientos "[AJUSTE] Ajuste de conciliacion"
    // etiquetados con proveedor "Andres" -- artefactos de pruebas de un
    // ciclo anterior, no pagos reales. Contaminaban el calculo de deuda
    // con montos que no le correspondian. Se les quita la etiqueta de
    // proveedor (sin borrar el registro, para no perder el rastro de
    // auditoria) para que dejen de contarse como pagos a Andres.
    const qGastosAndres = query(collection(db, PATHS.expenses), where('provider', '==', 'Andrés'));
    const snapGastos = await getDocs(qGastosAndres);
    for (const d of snapGastos.docs) {
      const concepto = String(d.data()?.concept || '');
      if (concepto.includes('[AJUSTE]')) {
        await updateDoc(d.ref, { provider: deleteField() });
      }
    }
    if (!snapGastos.empty) {
      logAction(userEmail, 'Gastos de Prueba Desetiquetados (Migracion Automatica)', { cantidad: snapGastos.size });
    }

    // Con ambas compras ya contando como Andres, el historico ajustado
    // antes (+21,824.44, calculado cuando solo una de las dos entregas
    // contaba) quedo desbalanceado -- mostraba -$978,849.92 en vez de la
    // deuda real. Se recalcula aqui, en la misma pasada, para que el
    // resultado final sea correcto sin que el usuario tenga que volver a
    // pedirlo.
    const refConfig = doc(db, PATHS.config, PATHS.configFinancials);
    const snapConfig = await getDoc(refConfig);
    if (snapConfig.exists() && Number(snapConfig.data()?.historicalDebtAndres || 0) !== HISTORICAL_DEBT_CORRECTO) {
      await updateDoc(refConfig, { historicalDebtAndres: HISTORICAL_DEBT_CORRECTO });
      logAction(userEmail, 'Historico Andres Recalculado (Migracion Automatica)', { historicalDebtAndres: HISTORICAL_DEBT_CORRECTO });
    }

    localStorage.setItem(MARCA, 'ok');
  } catch {
    // Si falla (permisos, red, lo que sea), simplemente no se marca --
    // se reintenta en la proxima carga. No se le muestra nada al usuario
    // porque no es una accion que el haya pedido ver, solo el resultado.
  }
}
