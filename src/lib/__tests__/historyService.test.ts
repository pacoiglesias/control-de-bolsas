import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDefaultSuggestions,
  saveLocalHistory,
  getLocalHistory,
  updateLocalHistoryItem,
  getLastUsed,
  addHistory,
} from '../../services/historyService';

describe('Mejora 1: Prellenado Inteligente y Servicio de Historial', () => {
  const testUserId = 'test_user_123';

  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    };
    vi.clearAllMocks();
  });

  it('proporciona sugerencias por defecto pertinentes cuando no hay historial previo', () => {
    const clientes = getDefaultSuggestions('cliente');
    expect(clientes.length).toBeGreaterThan(0);
    expect(clientes[0].name).toContain('PROVIDENCIA');

    const proveedores = getDefaultSuggestions('proveedor');
    expect(proveedores.length).toBeGreaterThan(0);
    expect(proveedores[0].name).toContain('Andrés');

    const productos = getDefaultSuggestions('producto');
    expect(productos.length).toBeGreaterThan(0);
    expect(productos[0].name).toContain('Bolsa de Polietileno');
  });

  it('guarda y recupera elementos de historial en caché local respetando el límite de 5 elementos', () => {
    const items = [
      { id: '1', name: 'Cliente A' },
      { id: '2', name: 'Cliente B' },
      { id: '3', name: 'Cliente C' },
      { id: '4', name: 'Cliente D' },
      { id: '5', name: 'Cliente E' },
      { id: '6', name: 'Cliente F' },
    ];

    saveLocalHistory(testUserId, 'cliente', items);
    const retrieved = getLocalHistory(testUserId, 'cliente');

    expect(retrieved).toHaveLength(5);
    expect(retrieved[0].name).toBe('Cliente A');
    expect(retrieved[4].name).toBe('Cliente E');
  });

  it('actualiza el historial priorizando el último elemento usado al inicio de la lista', () => {
    updateLocalHistoryItem(testUserId, 'proveedor', { id: 'p1', name: 'Andrés Gutiérrez' });
    updateLocalHistoryItem(testUserId, 'proveedor', { id: 'p2', name: 'Maquilas del Centro' });

    let history = getLocalHistory(testUserId, 'proveedor');
    expect(history[0].name).toBe('Maquilas del Centro');
    expect(history[1].name).toBe('Andrés Gutiérrez');

    // Reusar el primer elemento: debe moverse a la primera posición sin duplicar
    updateLocalHistoryItem(testUserId, 'proveedor', { id: 'p1', name: 'Andrés Gutiérrez' });
    history = getLocalHistory(testUserId, 'proveedor');

    expect(history[0].name).toBe('Andrés Gutiérrez');
    expect(history.filter((x: any) => x.name === 'Andrés Gutiérrez')).toHaveLength(1);
  });

  it('getLastUsed responde con historial local si Firestore está desconectado o en entorno mock', async () => {
    updateLocalHistoryItem(testUserId, 'producto', {
      id: 'prod_custom',
      name: 'Bolsa Especial Calibre 200',
    });

    const results = await getLastUsed(testUserId, 'producto');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Bolsa Especial Calibre 200');
  });

  it('addHistory registra en caché local y sincroniza de forma segura', async () => {
    await addHistory(testUserId, 'cliente', {
      id: 'cli_nuevo',
      name: 'Nuevo Cliente Providencia Tlaxcala',
    });

    const history = getLocalHistory(testUserId, 'cliente');
    expect(history[0].name).toBe('Nuevo Cliente Providencia Tlaxcala');
  });
});
