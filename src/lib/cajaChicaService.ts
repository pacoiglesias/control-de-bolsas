import { collection, doc, Timestamp } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import { safeSetDoc } from './safeFirestore';
import { round2 } from './finance';
import { SALDO_CAJA_ACTUAL } from './constants';

export async function calibrateCajaChicaToOfficial(currentCalc: number): Promise<{ diff: number; target: number }> {
  const target = SALDO_CAJA_ACTUAL;
  const diff = round2(target - currentCalc);
  if (Math.abs(diff) < 0.01) {
    return { diff: 0, target };
  }

  const newRef = doc(collection(db, PATHS.expenses));
  await safeSetDoc(newRef, {
    id: newRef.id,
    date: Timestamp.now(),
    concept: `Ajuste Oficial de Calibración de Caja Chica (${diff > 0 ? '+' : ''}$${Math.abs(diff).toLocaleString('es-MX', { minimumFractionDigits: 2 })})`,
    amount: Math.abs(diff),
    type: diff > 0 ? 'ingreso' : 'egreso',
    notes: 'Calibración automática a saldo físico en mano auditado ($451,848.56)',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return { diff, target };
}
