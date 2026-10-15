// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DEFAULT_CONFIG, type PurchaseOrder } from '../types';

const ui = vi.hoisted(() => ({ role: 'admin', navigate: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ role: ui.role }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => ui.navigate }));
vi.mock('../firebase', () => ({ db: {}, PATHS: {} }));
import { PriorityActionQueue } from '../../components/Dashboard/PriorityActionQueue';

let container: HTMLDivElement;
let root: Root;
const orders: PurchaseOrder[] = Array.from({ length: 4 }, (_, index) => ({ id: `o${index}`, oc: `OC-${index}`, client: 'Cliente', department: 'TH',
  totalKilograms: 1000, creditCycle: { status: 'pedido' }, deliveries: [{ id: `d${index}`, date: null, kilos: 500 }], invoices: [] }));

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  ui.role = 'admin'; ui.navigate.mockClear();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(list = orders, onInvoice = vi.fn()) {
  await act(async () => root.render(<PriorityActionQueue orders={list} config={DEFAULT_CONFIG} onOpenQuickInvoice={onInvoice} />));
}
async function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(element => element.textContent?.startsWith(label));
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

describe('Lista de próximos pasos: interacción con los componentes reales', () => {
  it('limita la lista inicial y permite expandirla sin perder tareas', async () => {
    await render();
    expect(container.querySelectorAll('article')).toHaveLength(6);
    await click('Ver los 8 pendientes');
    expect(container.querySelectorAll('article')).toHaveLength(8);
    await click('Mostrar solo los primeros 6');
    expect(container.querySelectorAll('article')).toHaveLength(6);
  });
  it('filtra por facturación y abre la orden elegida', async () => {
    const open = vi.fn(); await render(orders, open);
    await click('Facturar');
    expect(container.querySelectorAll('article')).toHaveLength(4);
    expect(container.querySelector('button[aria-pressed="true"]')?.textContent).toContain('Facturar');
    await click('Registrar factura');
    expect(open).toHaveBeenCalledWith('o0');
  });
  it('explica el estado vacío y ofrece limpiar filtros', async () => {
    await render(); await click('Contrarrecibos');
    expect(container.textContent).toContain('No hay pendientes con estos filtros.');
    await click('Limpiar filtros');
    expect(container.querySelectorAll('article')).toHaveLength(6);
    await render([]);
    expect(container.textContent).toContain('No hay pendientes registrados.');
  });
  it('en modo consulta abre el expediente sin ejecutar acciones de captura', async () => {
    ui.role = 'viewer'; const open = vi.fn(); await render(orders, open);
    await click('Ver expediente');
    expect(open).not.toHaveBeenCalled();
    expect(ui.navigate).toHaveBeenCalledWith('/ordenes?abrir=o0&tab=facturas');
  });
});
