import { useState, useEffect } from 'react';
import { useOrdersContext } from '../../context/OrdersContext';
import { QuickDeliveryModal } from './QuickDeliveryModal';
import { QuickInvoiceModal } from './QuickInvoiceModal';
import { QuickCollectionModal } from './QuickCollectionModal';
import { QuickCrModal } from '../QuickCrModal';
import type { PurchaseOrder, Invoice } from '../../lib/types';

export function GlobalFastFlowsHost() {
  const { orders } = useOrdersContext();

  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryInitialOrderId, setDeliveryInitialOrderId] = useState<string | null>(null);

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceInitialOrderId, setInvoiceInitialOrderId] = useState<string | null>(null);

  const [crCollectionModalOpen, setCrCollectionModalOpen] = useState(false);

  const [quickCrModalOpen, setQuickCrModalOpen] = useState(false);
  const [quickCrOrder, setQuickCrOrder] = useState<PurchaseOrder | null>(null);
  const [quickCrInvoice, setQuickCrInvoice] = useState<Invoice | null>(null);

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

    window.addEventListener('open-fast-delivery', handleOpenDelivery);
    window.addEventListener('open-fast-invoice', handleOpenInvoice);
    window.addEventListener('open-fast-cr-collection', handleOpenCrCollection);
    window.addEventListener('open-fast-quick-cr', handleOpenQuickCr);

    return () => {
      window.removeEventListener('open-fast-delivery', handleOpenDelivery);
      window.removeEventListener('open-fast-invoice', handleOpenInvoice);
      window.removeEventListener('open-fast-cr-collection', handleOpenCrCollection);
      window.removeEventListener('open-fast-quick-cr', handleOpenQuickCr);
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
    </>
  );
}
