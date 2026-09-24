import { useState, useEffect, useMemo } from 'react';
import { useOrdersContext } from '../../context/OrdersContext';
import { useExpenses } from '../../hooks/useExpenses';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { useToast } from '../../context/ToastContext';
import { QuickDeliveryModal } from './QuickDeliveryModal';
import { QuickInvoiceModal } from './QuickInvoiceModal';
import { QuickCollectionModal } from './QuickCollectionModal';
import { QuickCrModal } from '../QuickCrModal';
import { UniversalDocumentUploadModal } from '../Dashboard/UniversalDocumentUploadModal';
import { WhatsAppCommandHubModal } from '../WhatsApp/WhatsAppCommandHubModal';
import { ExpenseDrawer } from '../CajaChica/ExpenseDrawer';
import { doc, collection, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { round2 } from '../../lib/finance';
import type { PurchaseOrder, Invoice, Expense } from '../../lib/types';

export function GlobalFastFlowsHost() {
  const { orders } = useOrdersContext();
  const { expenses } = useExpenses();
  const { settings } = useSystemSettings();
  const toast = useToast();

  const provName = settings?.providerName || 'Andrés';
  const saldoCaja = useMemo(() => {
    return round2(
      (expenses || []).reduce((acc, e) => {
        return acc + (e.type === 'ingreso' ? Number(e.amount) || 0 : -(Number(e.amount) || 0));
      }, 0)
    );
  }, [expenses]);

  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryInitialOrderId, setDeliveryInitialOrderId] = useState<string | null>(null);

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceInitialOrderId, setInvoiceInitialOrderId] = useState<string | null>(null);

  const [crCollectionModalOpen, setCrCollectionModalOpen] = useState(false);

  const [quickCrModalOpen, setQuickCrModalOpen] = useState(false);
  const [quickCrOrder, setQuickCrOrder] = useState<PurchaseOrder | null>(null);
  const [quickCrInvoice, setQuickCrInvoice] = useState<Invoice | null>(null);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);

  const [expenseDrawerOpen, setExpenseDrawerOpen] = useState(false);
  const [expenseData, setExpenseData] = useState<Expense | null>(null);

  useEffect(() => {
    // Escuchar eventos globales del ERP
    const handleOpenDelivery = (e: any) => {
      const orderId = e?.detail?.orderId || null;
      setDeliveryInitialOrderId(orderId);
      setDeliveryModalOpen(true);
    };

    const handleOpenInvoice = (e: any) => {
      const orderId = e?.detail?.orderId || null;
      setInvoiceInitialOrderId(orderId);
      setInvoiceModalOpen(true);
    };

    const handleOpenCrCollection = () => {
      setCrCollectionModalOpen(true);
    };

    const handleOpenQuickCr = (e: any) => {
      const order = e?.detail?.order || null;
      const invoice = e?.detail?.invoice || null;
      if (order) {
        setQuickCrOrder(order);
        setQuickCrInvoice(invoice);
        setQuickCrModalOpen(true);
      }
    };

    const handleOpenUpload = () => {
      setUploadModalOpen(true);
    };

    const handleOpenWhatsapp = () => {
      setWhatsappModalOpen(true);
    };

    const handleOpenExpense = (e?: any) => {
      const expenseType = e?.detail?.type === 'ingreso' ? 'ingreso' : 'egreso';
      const newExp: Expense = {
        id: doc(collection(db, PATHS.expenses)).id,
        date: Timestamp.fromDate(new Date()),
        concept: e?.detail?.concept || '',
        amount: Number(e?.detail?.amount) || 0,
        type: expenseType,
        provider: e?.detail?.provider || '',
        notes: e?.detail?.notes || '',
        createdAt: null,
      };
      setExpenseData(newExp);
      setExpenseDrawerOpen(true);
    };

    window.addEventListener('open-fast-delivery', handleOpenDelivery);
    window.addEventListener('open-fast-invoice', handleOpenInvoice);
    window.addEventListener('open-fast-cr-collection', handleOpenCrCollection);
    window.addEventListener('open-fast-quick-cr', handleOpenQuickCr);
    window.addEventListener('open-fast-upload', handleOpenUpload);
    window.addEventListener('open-fast-whatsapp', handleOpenWhatsapp);
    window.addEventListener('open-fast-expense', handleOpenExpense);

    return () => {
      window.removeEventListener('open-fast-delivery', handleOpenDelivery);
      window.removeEventListener('open-fast-invoice', handleOpenInvoice);
      window.removeEventListener('open-fast-cr-collection', handleOpenCrCollection);
      window.removeEventListener('open-fast-quick-cr', handleOpenQuickCr);
      window.removeEventListener('open-fast-upload', handleOpenUpload);
      window.removeEventListener('open-fast-whatsapp', handleOpenWhatsapp);
      window.removeEventListener('open-fast-expense', handleOpenExpense);
    };
  }, []);

  return (
    <>
      {deliveryModalOpen && (
        <QuickDeliveryModal
          orders={orders}
          initialOrderId={deliveryInitialOrderId}
          onClose={() => {
            setDeliveryModalOpen(false);
            setDeliveryInitialOrderId(null);
          }}
          onOpenInvoice={(orderId) => {
            setDeliveryModalOpen(false);
            setInvoiceInitialOrderId(orderId);
            setInvoiceModalOpen(true);
          }}
        />
      )}

      {invoiceModalOpen && (
        <QuickInvoiceModal
          orders={orders}
          initialOrderId={invoiceInitialOrderId}
          onClose={() => {
            setInvoiceModalOpen(false);
            setInvoiceInitialOrderId(null);
          }}
        />
      )}

      {crCollectionModalOpen && (
        <QuickCollectionModal
          orders={orders}
          onClose={() => setCrCollectionModalOpen(false)}
        />
      )}

      {quickCrModalOpen && quickCrOrder && (
        <QuickCrModal
          order={quickCrOrder}
          invoice={quickCrInvoice}
          onClose={() => {
            setQuickCrModalOpen(false);
            setQuickCrOrder(null);
            setQuickCrInvoice(null);
          }}
        />
      )}
      {uploadModalOpen && (
        <UniversalDocumentUploadModal
          onClose={() => setUploadModalOpen(false)}
        />
      )}

      {whatsappModalOpen && (
        <WhatsAppCommandHubModal
          onClose={() => setWhatsappModalOpen(false)}
          toast={toast}
        />
      )}

      {expenseDrawerOpen && expenseData && (
        <ExpenseDrawer
          expense={expenseData}
          provName={provName}
          saldoCajaActual={saldoCaja}
          onClose={() => {
            setExpenseDrawerOpen(false);
            setExpenseData(null);
          }}
        />
      )}
    </>
  );
}
