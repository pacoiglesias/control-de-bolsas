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
const MARCA = 'cb_migracion_restaurar_trenHXXX_v1';
const ID_EXPEDIENTE = 'trenHXXXa9nYzxB7Kxi5';

export async function restaurarExpedienteAutomaticamente(userEmail: string | undefined | null) {
  if (typeof window === 'undefined' || !userEmail) return;
  if (localStorage.getItem(MARCA)) return;

  try {
    const ref = doc(db, PATHS.orders, ID_EXPEDIENTE);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      localStorage.setItem(MARCA, 'ok-no-existe');
      return;
    }
    if (snap.data()?.isDeleted !== true) {
      localStorage.setItem(MARCA, 'ok-ya-restaurado');
      return;
    }
    await updateDoc(ref, {
      isDeleted: deleteField(),
      deletedAt: deleteField(),
      deletedBy: deleteField(),
    });
    logAction(userEmail, 'Expediente Restaurado (Migracion Automatica)', { orderId: ID_EXPEDIENTE });
    localStorage.setItem(MARCA, 'ok-restaurado');
  } catch {
    // Si falla (permisos, red, lo que sea), simplemente no se marca --
    // se reintenta en la proxima carga. No se le muestra nada al usuario
    // porque no es una accion que el haya pedido ver, solo el resultado.
  }
}
