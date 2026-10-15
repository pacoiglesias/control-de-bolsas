import type { PurchaseOrder, Invoice, FinancialConfig } from '../../lib/types';
import { QuickInvoiceModal } from '../FastFlows/QuickInvoiceModal';

interface Props { order: PurchaseOrder; kilosPendientes: number; dynamicConfig: FinancialConfig; config: FinancialConfig; onClose: () => void; onCreated?: (invoice: Invoice) => void; }

/** All entry points use the same real delivery/concept model and transactional save. */
export function EmitirFacturaModal({ order, onClose, onCreated }: Props) {
 return <QuickInvoiceModal orders={[order]} initialOrderId={order.id} onClose={onClose} onCreated={onCreated} />;
}
