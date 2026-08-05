import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
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
const MARCA = 'cb_migracion_restaurar_trenHXXX_v2';
const ID_EXPEDIENTE = 'trenHXXXa9nYzxB7Kxi5';
const KILOS_REALES = 23825.58;

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

    localStorage.setItem(MARCA, 'ok');
  } catch {
    // Si falla (permisos, red, lo que sea), simplemente no se marca --
    // se reintenta en la proxima carga. No se le muestra nada al usuario
    // porque no es una accion que el haya pedido ver, solo el resultado.
  }
}
