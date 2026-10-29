import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAppDiag,
  sanitizeDiagDetails,
  APP_DIAG_MAX_EVENTS,
} from '../appDiag';

/**
 * Log de diagnóstico local (patrón Alacena 3.9.5 adaptado a Bolsas):
 * registro acotado en localStorage, con sanitización que borra datos
 * del negocio aunque un llamador los pase por error. Estas pruebas fijan
 * ese contrato: si alguien relaja la sanitización, o el tope, o la
 * limpieza, alguna prueba lo detecta.
 */

function installStubStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  return store;
}

describe('appDiag (diagnóstico local de Bolsas)', () => {
  beforeEach(() => {
    installStubStorage();
  });

  it('guarda y devuelve eventos con versión, fecha y tipo', () => {
    const diag = createAppDiag('test:bolsas_diag_1');
    diag.log('firestore_write_error', { op: 'set', errorCode: 'permission-denied' });
    const events = diag.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].ev).toBe('firestore_write_error');
    expect(events[0].d).toEqual({ op: 'set', errorCode: 'permission-denied' });
    expect(events[0].t).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(events[0].v).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it('conserva solo los últimos 200 eventos', () => {
    const diag = createAppDiag('test:bolsas_diag_2');
    for (let i = 0; i < APP_DIAG_MAX_EVENTS + 50; i++) {
      diag.log('window_error', { n: i });
    }
    const events = diag.getEvents();
    expect(events).toHaveLength(APP_DIAG_MAX_EVENTS);
    expect((events[0].d as Record<string, unknown>).n).toBe(50);
    expect((events[events.length - 1].d as Record<string, unknown>).n).toBe(
      APP_DIAG_MAX_EVENTS + 49,
    );
  });

  it('borra claves de negocio aunque el llamador las pase por error', () => {
    const cleaned = sanitizeDiagDetails({
      op: 'set',
      errorCode: 'unavailable',
      cliente: 'Grupo Textil Providencia',
      importe: 123456,
      kilos: 5000,
      folio: '43/9784',
      email: 'alguien@ejemplo.com',
      uid: 'abc123',
      anidado: { producto: 'Bolsa', total: 999, errorCode: 'ok' },
    });
    expect(cleaned).toEqual({
      op: 'set',
      errorCode: 'unavailable',
      anidado: { errorCode: 'ok' },
    });
  });

  it('recorta textos largos a 200 caracteres', () => {
    const cleaned = sanitizeDiagDetails({ message: 'x'.repeat(500) });
    expect((cleaned.message as string)).toHaveLength(200);
  });

  it('limpia el registro y el texto copiable no incluye datos borrados', () => {
    const diag = createAppDiag('test:bolsas_diag_3');
    diag.log('auth_signin_error', { errorCode: 'auth/invalid-credential' });
    diag.log('app_error', { cliente: 'Secreto', errorName: 'TypeError' });
    const text = diag.toText();
    expect(text).toContain('auth_signin_error');
    expect(text).toContain('TypeError');
    expect(text).not.toContain('Secreto');
    diag.clear();
    expect(diag.getEvents()).toHaveLength(0);
  });

  it('sobrevive sin localStorage (respaldo en memoria)', () => {
    delete (globalThis as unknown as Record<string, unknown>).localStorage;
    const diag = createAppDiag('test:bolsas_diag_4');
    diag.log('session_start', { online: true });
    expect(diag.getEvents()).toHaveLength(1);
    expect(diag.getEvents()[0].ev).toBe('session_start');
  });
});
