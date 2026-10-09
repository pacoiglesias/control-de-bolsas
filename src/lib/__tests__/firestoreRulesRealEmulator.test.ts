import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = 'control-de-bolsas-89c88';
const isEmulatorActive = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!isEmulatorActive)('Pruebas en Emulador Real de Firestore: Roles y Ciclo de Vida de Comprobantes', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    if (!isEmulatorActive) return;
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    const [host, portStr] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
    const port = Number(portStr) || 8080;

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: rulesContent,
        host,
        port,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  describe('1. Usuario No Autenticado', () => {
    it('bloquea lectura y escritura de purchaseOrders y payment_receipts', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertFails(unauthDb.collection('purchaseOrders').get());
      await assertFails(
        unauthDb.collection('purchaseOrders').doc('ord-1').set({ oc: '123' })
      );
      await assertFails(unauthDb.collection('payment_receipts').get());
      await assertFails(
        unauthDb.collection('payment_receipts').doc('rec-1').set({ amount: 100 })
      );
    });
  });

  describe('2. Rol Operativo: Viewer (Lector)', () => {
    it('permite leer purchaseOrders pero bloquea crear/editar y bloquea payment_receipts', async () => {
      // Configuramos el rol en /admins/viewer-uid usando contexto admin del emulador
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await adminContext.firestore().collection('admins').doc('viewer-uid').set({
          role: 'viewer',
          email: 'lector@cobertores.com',
        });
        await adminContext.firestore().collection('purchaseOrders').doc('ord-test-1').set({
          oc: '12026439784',
          folio: '43/9784',
          totalKilograms: 5100,
        });
      });

      const viewerDb = testEnv
        .authenticatedContext('viewer-uid', {
          email: 'lector@cobertores.com',
          email_verified: true,
        })
        .firestore();

      // Puede leer órdenes
      await assertSucceeds(viewerDb.collection('purchaseOrders').doc('ord-test-1').get());

      // No puede crear ni editar órdenes
      await assertFails(
        viewerDb.collection('purchaseOrders').doc('ord-test-2').set({
          oc: '120267114302',
          folio: '71/14302',
        })
      );
      await assertFails(
        viewerDb.collection('purchaseOrders').doc('ord-test-1').update({
          notes: 'intento de edición',
        })
      );

      // No puede leer ni escribir comprobantes bancarios
      await assertFails(viewerDb.collection('payment_receipts').doc('rec-1').get());
      await assertFails(
        viewerDb.collection('payment_receipts').doc('rec-1').set({
          receiptKey: 'rec-1',
          amount: 5000,
        })
      );
    });
  });

  describe('3. Rol Operativo: Manager (Gerente)', () => {
    it('permite crear órdenes y registrar comprobantes con estados (applied y pending_review)', async () => {
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await adminContext.firestore().collection('admins').doc('manager-uid').set({
          role: 'manager',
          email: 'gerente@cobertores.com',
        });
      });

      const managerDb = testEnv
        .authenticatedContext('manager-uid', {
          email: 'gerente@cobertores.com',
          email_verified: true,
        })
        .firestore();

      // Puede crear y actualizar órdenes
      await assertSucceeds(
        managerDb.collection('purchaseOrders').doc('ord-mgr-1').set({
          oc: '12026439784',
          folio: '43/9784',
          totalKilograms: 5100,
        })
      );
      await assertSucceeds(
        managerDb.collection('purchaseOrders').doc('ord-mgr-1').update({
          notes: 'actualizado por gerencia',
        })
      );

      // No puede eliminar órdenes (reservado para SuperAdmin)
      await assertFails(managerDb.collection('purchaseOrders').doc('ord-mgr-1').delete());

      // Crear comprobante legítimo con estado 'applied'
      const appliedReceiptKey = 'BANK_SPEI_998877_INV_6353_A1B2C3D4';
      await assertSucceeds(
        managerDb.collection('payment_receipts').doc(appliedReceiptKey).set({
          receiptKey: appliedReceiptKey,
          status: 'applied',
          orderId: 'ord-mgr-1',
          orderFolio: '43/9784',
          amount: 49880.0,
          trackingKey: 'SPEI-998877',
          bankReference: null,
          fileSha256: null,
          appliedAt: new Date().toISOString(),
          appliedBy: 'gerente@cobertores.com',
        })
      );

      // Crear comprobante con estado 'pending_review'
      const reviewReceiptKey = 'BANK_REF_554433_INV_6354_B2C3D4E5';
      await assertSucceeds(
        managerDb.collection('payment_receipts').doc(reviewReceiptKey).set({
          receiptKey: reviewReceiptKey,
          status: 'pending_review',
          orderId: 'ord-mgr-1',
          orderFolio: '43/9784',
          amount: 25000.0,
          trackingKey: null,
          bankReference: 'REF-554433',
          fileSha256: null,
          appliedAt: new Date().toISOString(),
          appliedBy: 'gerente@cobertores.com',
        })
      );
    });

    it('permite a Manager transicionar comprobante de pending_review a rejected o applied protegiendo campos inmutables', async () => {
      const receiptKey = 'BANK_REF_REV1_INV_6355_C3D4E5F6';

      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await adminContext.firestore().collection('admins').doc('manager-uid').set({
          role: 'manager',
          email: 'gerente@cobertores.com',
        });
        await adminContext.firestore().collection('payment_receipts').doc(receiptKey).set({
          receiptKey,
          status: 'pending_review',
          orderId: 'ord-100',
          amount: 15000.0,
          bankReference: 'REF-REV1',
          appliedAt: '2026-10-09T10:00:00Z',
          appliedBy: 'gerente@cobertores.com',
        });
      });

      const managerDb = testEnv
        .authenticatedContext('manager-uid', {
          email: 'gerente@cobertores.com',
          email_verified: true,
        })
        .firestore();

      // Manager puede resolver a 'rejected' con nota
      await assertSucceeds(
        managerDb.collection('payment_receipts').doc(receiptKey).update({
          status: 'rejected',
          rejectionReason: 'Comprobante duplicado en banco',
          reviewedBy: 'gerente@cobertores.com',
        })
      );

      // Manager NO puede cambiar el monto ni el orderId (inmutabilidad estricta)
      await assertFails(
        managerDb.collection('payment_receipts').doc(receiptKey).update({
          amount: 999999.0, // Intento de alteración de monto
        })
      );
      await assertFails(
        managerDb.collection('payment_receipts').doc(receiptKey).update({
          orderId: 'ord-OTRA', // Intento de cambiar la orden
        })
      );
    });

    it('rechaza comprobante si receiptKey no coincide con el docId o falta identidad bancaria fuerte', async () => {
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await adminContext.firestore().collection('admins').doc('manager-uid').set({
          role: 'manager',
          email: 'gerente@cobertores.com',
        });
      });

      const managerDb = testEnv
        .authenticatedContext('manager-uid', {
          email: 'gerente@cobertores.com',
          email_verified: true,
        })
        .firestore();

      // Desajuste de clave
      await assertFails(
        managerDb.collection('payment_receipts').doc('DOC_KEY_REAL').set({
          receiptKey: 'DOC_KEY_DISTINTA',
          orderId: 'ord-1',
          amount: 5000,
          trackingKey: 'SPEI-123',
          appliedAt: new Date().toISOString(),
          appliedBy: 'gerente@cobertores.com',
        })
      );

      // Falta identidad fuerte (sin trackingKey, bankReference ni sha256)
      await assertFails(
        managerDb.collection('payment_receipts').doc('DOC_KEY_SIN_IDENTIDAD').set({
          receiptKey: 'DOC_KEY_SIN_IDENTIDAD',
          orderId: 'ord-1',
          amount: 5000,
          trackingKey: null,
          bankReference: null,
          fileSha256: null,
          appliedAt: new Date().toISOString(),
          appliedBy: 'gerente@cobertores.com',
        })
      );
    });
  });

  describe('4. Rol Operativo: Admin y SuperAdmin', () => {
    it('permite a SuperAdmin eliminar órdenes y comprobantes', async () => {
      const receiptKey = 'BANK_DEL_1_INV_6356_D4E5F6A1';
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await adminContext.firestore().collection('admins').doc('admin-uid').set({
          role: 'admin',
          email: 'admin@cobertores.com',
        });
        await adminContext.firestore().collection('purchaseOrders').doc('ord-del').set({
          oc: '12026439784',
          folio: '43/9784',
        });
        await adminContext.firestore().collection('payment_receipts').doc(receiptKey).set({
          receiptKey,
          status: 'applied',
          orderId: 'ord-del',
          amount: 1000,
          bankReference: 'REF-DEL',
          appliedAt: new Date().toISOString(),
          appliedBy: 'admin@cobertores.com',
        });
      });

      const adminDb = testEnv
        .authenticatedContext('admin-uid', {
          email: 'admin@cobertores.com',
          email_verified: true,
          admin: true,
        })
        .firestore();

      // SuperAdmin puede eliminar
      await assertSucceeds(adminDb.collection('payment_receipts').doc(receiptKey).delete());
      await assertSucceeds(adminDb.collection('purchaseOrders').doc('ord-del').delete());
    });
  });

  describe('5. Bootstrap Owner (Arranque Seguro)', () => {
    it('otorga privilegios de administración al correo dueño verificado sin documento previo', async () => {
      const ownerDb = testEnv
        .authenticatedContext('owner-uid', {
          email: 'pacoismael@gmail.com',
          email_verified: true,
        })
        .firestore();

      // Puede leer y crear órdenes inmediatamente
      await assertSucceeds(
        ownerDb.collection('purchaseOrders').doc('ord-owner').set({
          oc: '120267114302',
          folio: '71/14302',
          totalKilograms: 8000,
        })
      );
      await assertSucceeds(ownerDb.collection('purchaseOrders').doc('ord-owner').get());
    });
  });
});
