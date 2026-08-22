import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { FieldValue, FieldPath, Timestamp, getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { normalizarTexto, computeAndresBalance } from "../shared/finance.core";
import { COL_ORDERS } from "./shared";

// FIX (v8.9.10, split de functions/src/index.ts -- 1,292 líneas): todo lo
// del Portal Maquilador (PIN, listar órdenes activas, registrar entrega,
// importar entrega retroactiva) vivía mezclado con el resto del backend
// en un solo archivo. Se extrae tal cual, sin cambiar ninguna lógica --
// mismos nombres de función exportados (Firebase Functions los identifica
// por nombre, no por archivo; renombrarlos crearía funciones nuevas y
// dejaría huérfanas las desplegadas). `index.ts` sigue re-exportando
// estos tres nombres para que el despliegue no cambie en nada.

const MAQUILA_PIN_REF_PATH = 'system_settings_private/maquila';
const MAQUILA_PIN_MAX_INTENTOS = 5;
const MAQUILA_PIN_BLOQUEO_MINUTOS = 15;

/**
 * FIX (v8.9.2): el PIN del Portal Maquilador son 4 digitos (10,000
 * combinaciones) y esta funcion es publica -- sin limite de intentos,
 * cualquiera podia programar un script que probara las 10,000 combinaciones
 * en minutos y quedarse dentro (ver el estado de cuenta real de Andres, o
 * registrar entregas falsas). Ahora, despues de 5 intentos fallidos
 * seguidos, se bloquea 15 minutos -- se lee y escribe en una transaccion
 * para que dos intentos simultaneos no se "brinquen" el contador.
 *
 * Tambien se quita el valor por defecto '2468': si el documento del PIN no
 * existe o no tiene el campo 'pin', ahora la funcion falla cerrada (nadie
 * entra) en vez de fallar abierta hacia un PIN conocido y publicado en el
 * historial de este mismo repositorio.
 */
async function validarPinMaquila(db: FirebaseFirestore.Firestore, pinIntentado: string): Promise<void> {
  const ref = db.doc(MAQUILA_PIN_REF_PATH);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const realPin = data.pin;
    if (!realPin) {
      throw new HttpsError('failed-precondition', 'El PIN del portal no esta configurado. Contacta al administrador.');
    }

    const ahora = Date.now();
    const bloqueadoHastaMs = data.pinLockedUntil ? (data.pinLockedUntil as FirebaseFirestore.Timestamp).toMillis() : 0;
    if (bloqueadoHastaMs > ahora) {
      const minutosRestantes = Math.ceil((bloqueadoHastaMs - ahora) / 60000);
      throw new HttpsError('resource-exhausted', `Demasiados intentos fallidos. Intenta de nuevo en ${minutosRestantes} minuto(s).`);
    }

    if (pinIntentado === realPin) {
      // Exito: se limpia el contador para no arrastrar intentos viejos.
      if (data.pinFailedAttempts || data.pinLockedUntil) {
        tx.update(ref, { pinFailedAttempts: FieldValue.delete(), pinLockedUntil: FieldValue.delete() });
      }
      return;
    }

    const intentosPrevios = bloqueadoHastaMs > 0 ? 0 : (data.pinFailedAttempts || 0);
    const intentos = intentosPrevios + 1;
    if (intentos >= MAQUILA_PIN_MAX_INTENTOS) {
      const bloqueadoHasta = Timestamp.fromMillis(ahora + MAQUILA_PIN_BLOQUEO_MINUTOS * 60000);
      tx.update(ref, { pinFailedAttempts: 0, pinLockedUntil: bloqueadoHasta });
      throw new HttpsError('resource-exhausted', `Demasiados intentos fallidos. Intenta de nuevo en ${MAQUILA_PIN_BLOQUEO_MINUTOS} minuto(s).`);
    }
    tx.update(ref, { pinFailedAttempts: intentos });
    throw new HttpsError('permission-denied', 'PIN incorrecto');
  });
}

// Force deploy to fix CORS/IAM policy
//
// FIX (v8.9.9, auditoría Staff Engineer -- rendimiento/costes): esta función
// hace hasta 3 scans completos de colección (purchases, purchaseOrders en
// lotes, expenses) en cada refresco del Portal Maquilador, porque el match
// de proveedor es por texto normalizado (acentos/mayúsculas) y Firestore no
// puede filtrar eso con `where` sin agregar un campo indexado nuevo -- un
// cambio de esquema que requiere migrar datos existentes y no se hace aquí
// sin validarlo primero con el negocio (ver AUDIT_NOTEBOOK.md). Mientras
// tanto, se fija un límite explícito de memoria/tiempo (antes usaba el
// default de Cloud Functions) para que un crecimiento futuro de estas
// colecciones falle con un timeout claro en vez de agotar memoria en
// silencio.
export const getActiveMaquilaOrders = onCall({ invoker: "public", cors: true, memory: "256MiB", timeoutSeconds: 60 }, async (request) => {

  const { action, pin } = request.data || {};
  const db = getFirestore();

  // El PIN se exige para CUALQUIER accion de esta funcion, no solo
  // "ledger". Antes el camino por defecto (listar/registrar entregas) no
  // pedia PIN en absoluto en el servidor — el "candado" solo vivia en el
  // navegador, y cualquiera con la URL de la funcion podia llamarla
  // directo sin PIN. Ademas, el PIN real ahora se lee de un documento que
  // Firestore nunca deja leer al cliente (system_settings_private), no del
  // documento publico donde vivia antes.
  if (!pin) throw new HttpsError('invalid-argument', 'PIN requerido');
  await validarPinMaquila(db, pin);

  if (action === 'registrarEntrega') {
    return await procesarRegistroEntregaMaquila(db, request.data);
  }

  if (action === 'ledger') {
    const configSnap = await db.collection('config').doc('financials').get();
    const costPricePerKg = configSnap.data()?.costPricePerKg || 42;
    const historicalDebtAndres = configSnap.data()?.historicalDebtAndres || 0;

    const purchasesSnap = await db.collection('purchases').get();
    // FIX (v8.9.5): comparaba con .toLowerCase() simple, que nunca hace match
    // contra "Andrés" (con acento) -- el nombre real que escriben
    // OrderModals.tsx y PagarAndresModal.tsx. Por eso el Estado de Cuenta del
    // Portal Maquilador mostraba $0.00 / 0 kg entregados aunque si hubiera
    // compras reales. normalizarTexto() ya resuelve esto en el frontend;
    // ahora es compartida.
    //
    // FIX (v8.9.7): el match seguia siendo EXACTO ('andres' == 'andres'), lo
    // cual excluye en silencio cualquier variante como "Andrés (Maquilador)"
    // o "Proveedor Andrés" -- el usuario reporto que los montos del Portal
    // Maquilador se veian "fuera de los datos reales", y esta es la causa
    // mas probable: registros reales que nunca entraban a la suma. Ahora se
    // hace match por CONTIENE (no solo es-igual-a), ya que "andres" es un
    // nombre propio distintivo y el negocio solo tiene un proveedor con ese
    // nombre -- no hay riesgo real de capturar un proveedor distinto por
    // error. Ademas se recolecta un diagnostico (abajo) de cualquier
    // proveedor que contenga una variante cercana ("andr...") pero que NO
    // haya hecho match, para poder confirmarlo sin necesitar acceso directo
    // a Firestore.
    const esAndres = (provider: unknown) =>
      typeof provider === 'string' && provider.trim() !== '' && normalizarTexto(provider).includes('andres');

    const provPurchases = purchasesSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((p: any) => esAndres(p.provider));

    const orderIds = provPurchases.map(p => p.id);
    const orderById = new Map();
    if (orderIds.length > 0) {
      // FIX (v8.9.7): antes se leia la coleccion 'purchaseOrders' COMPLETA
      // solo para mapear folio por id -- aqui si es seguro usar un query
      // exacto por documentId() (sin normalizacion de texto de por medio),
      // en lotes de 10 (limite de Firestore para el operador 'in').
      const CHUNK = 10;
      for (let i = 0; i < orderIds.length; i += CHUNK) {
        const chunk = orderIds.slice(i, i + CHUNK);
        const ordersSnap = await db.collection('purchaseOrders').where(FieldPath.documentId(), 'in', chunk).get();
        ordersSnap.docs.forEach(d => {
          orderById.set(d.id, d.data());
        });
      }
    }

    const expensesSnap = await db.collection('expenses').get();
    const provExpenses = expensesSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((e: any) => esAndres(e.provider));

    // Diagnostico: proveedores que se parecen a "Andres" (contienen "andr")
    // pero que el filtro esAndres() NO capturo -- si esta lista sale vacia
    // una vez desplegado, confirma que ya no hay registros perdidos por
    // ortografia/acentos. Se manda en la respuesta para poder revisarlo
    // desde la consola del navegador sin tocar Firestore directamente.
    const proveedoresParecidosNoCapturados = new Set<string>();
    [...purchasesSnap.docs, ...expensesSnap.docs].forEach(d => {
      const provider = (d.data() as any)?.provider;
      if (typeof provider === 'string' && provider.trim() !== '') {
        const norm = normalizarTexto(provider);
        if (norm.includes('andr') && !norm.includes('andres')) {
          proveedoresParecidosNoCapturados.add(provider);
        }
      }
    });

    // FIX (auditoría v8.9.5): esta misma fórmula (kilos/costo/pagado/saldo)
    // vivía copiada aquí, en src/hooks/useAndresStats.ts y en
    // src/hooks/useDashboardStatsV2.ts -- la misma clase de bug que causó
    // el incidente real del "Saldo con Andrés" ($1.3M de diferencia entre
    // el Dashboard y esta misma pantalla, para el mismo dato). Ahora las
    // tres llaman a computeAndresBalance(), la fuente única de verdad.
    const andresBalance = computeAndresBalance(
      provPurchases as any[],
      provExpenses as any[],
      { costPricePerKg, historicalDebtAndres },
      "andres",
    );
    const { totalReceivedKilos, totalPurchasesCost, totalPagado, saldoProveedor } = andresBalance;

    const ledger: any[] = [
      ...provPurchases.map((p: any) => ({
        id: p.id,
        date: p.date, 
        concept: `Entrega (Amortización) OC-${orderById.get(p.id)?.folio || 'S/F'}`,
        cargo: ((p.receivedKilos ?? 0) * (p.pricePerKg || costPricePerKg)),
        abono: 0,
        balance: 0,
        source: 'purchase'
      })).filter((x: any) => x.cargo > 0),
      ...provExpenses.map((e: any) => ({
        id: e.id,
        date: e.date,
        concept: e.concept || '',
        cargo: e.type === 'ingreso' ? (e.amount || 0) : 0, 
        abono: e.type === 'egreso' ? (e.amount || 0) : 0, 
        balance: 0,
        source: 'expense'
      }))
    ];

    const getMillis = (dateObj: any) => {
      if (!dateObj) return 0;
      if (dateObj.toMillis) return dateObj.toMillis();
      if (dateObj._seconds) return dateObj._seconds * 1000;
      return 0;
    };

    ledger.sort((a, b) => getMillis(a.date) - getMillis(b.date));

    let running = -historicalDebtAndres;
    for (const row of ledger) {
      running += row.cargo;
      running -= row.abono;
      row.balance = running;
      
      row.dateMillis = getMillis(row.date);
      delete row.date;
    }
    ledger.reverse();

    return {
      totalReceivedKilos,
      totalPurchasesCost,
      totalPagado,
      saldoProveedor,
      ledger,
      diagnostico: {
        registrosCompras: provPurchases.length,
        registrosGastos: provExpenses.length,
        proveedoresParecidosNoCapturados: Array.from(proveedoresParecidosNoCapturados),
      },
    };
  }

  // Original getActiveMaquilaOrders logic
  //
  // NOTA (auditoría v8.9.10, optimización diferida a propósito): esta lectura
  // completa de COL_ORDERS crece con el historial total de órdenes, no solo
  // con las activas -- en teoría un `where('isArchived','==',false)` +
  // `where('creditCycle.status','in',[...])` server-side reduciría el
  // número de documentos leídos. NO se implementó: Firestore excluye de la
  // consulta cualquier documento donde el campo usado en el filtro no
  // exista en absoluto (no solo cuando es false/distinto), y este mismo
  // proyecto ya sufrió exactamente ese bug una vez (ver la nota en
  // src/context/OrdersContext.tsx sobre por qué se quitó
  // `orderBy('processedAt','desc')`: al menos un expediente real no tenía
  // ese campo y desaparecía en silencio de la lista). isArchived y
  // creditCycle.status tienen el mismo riesgo aquí -- expedientes viejos
  // sin uno de los dos campos se volverían invisibles para Andrés en el
  // Portal Maquilador sin ningún error visible. Aplicar el filtro de forma
  // segura requeriría primero una migración que garantice ambos campos en
  // el 100% de los documentos existentes; sin poder correr esa migración y
  // verificarla contra los datos reales, se deja el escaneo completo
  // (correcto aunque no óptimo) en vez de arriesgar una regresión invisible
  // de datos financieros reales.
  const snapshot = await db.collection(COL_ORDERS).get();

  const activeOrders: any[] = [];
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.isArchived || data.isClosedShort) return;

    // Si la orden ya cuenta con contrarecibo oficial (a nivel raíz o en cualquiera de sus facturas),
    // la mercancía ya fue recibida por el cliente y ya NO está en proceso de maquila/producción.
    const hasCrRoot = Boolean(data.collection?.contrareciboNumber?.trim());
    const hasCrInvoices = Array.isArray(data.invoices) && data.invoices.length > 0 && data.invoices.some((inv: any) => Boolean(inv.collection?.contrareciboNumber?.trim()));
    if (hasCrRoot || hasCrInvoices) return;

    const status = data.creditCycle?.status || "pedido";
    // Solo órdenes en proceso de producción real
    if (status === "pedido" || status === "manual_review") {
      const deliveries = data.deliveries || [];
      const totalDelivered = deliveries.reduce((acc: number, d: any) => acc + (d.kilos || 0), 0);
      const totalKilos = data.totalKilograms || 0;
      const pendingKilos = totalKilos - totalDelivered;

      if (pendingKilos > 0) {
        activeOrders.push({
          orderId: doc.id,
          folio: data.folio || "Sin Folio",
          productDescription: data.productDescription || "Producto",
          totalKilos,
          pendingKilos,
        });
      }
    }
  });

  return activeOrders;
});

// FIX (protección + bitácora, a raíz de una revisión del Portal Maquilador):
// antes el portal escribia entregas directo a Firestore desde el cliente
// (addDoc a maquilaDeliveries), permitido por la regla "request.auth !=
// null". El problema: cualquiera puede llamar signInAnonymously() desde la
// consola del navegador -- la configuracion publica de Firebase (apiKey,
// projectId, etc.) no es secreta, viaja en cualquier build del sitio -- y
// con eso escribir entregas falsas SIN conocer el PIN real. La lectura ya
// estaba protegida (getActiveMaquilaOrders valida el PIN en el servidor);
// la escritura no lo estaba.
//
// Esta funcion mueve la escritura al servidor: valida el PIN igual que
// getActiveMaquilaOrders, y solo entonces crea la entrega con el Admin SDK
// (que no pasa por las reglas de Firestore). Ademas deja un registro en
// system_logs -- la bitácora que ya usa el resto del sistema (Logs.tsx) --
// para poder ver despues qué se registró desde el portal, cuándo y para
// qué expediente. firestore.rules ya no permite crear maquilaDeliveries
// desde el cliente en absoluto (ver v8.8.9): todo pasa por aquí.
export async function procesarRegistroEntregaMaquila(db: FirebaseFirestore.Firestore, data: any) {
  const { pin, orderId, folio, productDescription, kilos, docType, docFolio, notes } = data || {};

  if (!pin) throw new HttpsError('invalid-argument', 'PIN requerido');
  await validarPinMaquila(db, pin);

  const kilosNum = Number(kilos);
  if (!orderId || !Number.isFinite(kilosNum) || kilosNum <= 0) {
    throw new HttpsError('invalid-argument', 'Datos de entrega incompletos o inválidos');
  }

  // FIX (v8.9.9): antes esta función SOLO escribía un registro en
  // `maquilaDeliveries` (una bitácora/bandeja aparte) y dependía de que un
  // administrador entrara luego al expediente y presionara "Importar" a
  // mano para que la entrega contara de verdad en `deliveries[]` del
  // expediente -- el campo del que se calculan los kilos pendientes
  // (`pendingKilos`, usado por `getActiveMaquilaOrders` para decidir qué
  // le sigue apareciendo como pendiente a Andrés). Ese paso manual además
  // estaba roto: intentaba emparejar la entrega con un producto de la OC
  // usando `d.productCode`, un campo que esta misma función nunca guardó
  // -- así que la búsqueda casi nunca encontraba el producto correcto.
  // Resultado real: confirmar kilos en el Portal Maquilador casi nunca
  // reducía los kilos pendientes del expediente, así que un expediente ya
  // entregado por completo (con contrarecibo del lado del cliente, solo a
  // la espera de que paguen) seguía apareciendo como "activo"/pendiente en
  // la lista de Andrés indefinidamente.
  //
  // Ahora la entrega se escribe DIRECTO en `purchaseOrders/{orderId}.
  // deliveries[]` dentro de una transacción (misma colección y mismo
  // campo que usa el resto del sistema -- TabEntregas, finance.ts,
  // stats.ts), así que "pendingKilos" se actualiza de inmediato y de
  // forma correcta la primera vez, sin depender de que nadie recuerde
  // hacer una importación manual aparte.
  const now = FieldValue.serverTimestamp();
  const deliveryId = randomUUID();
  const orderRef = db.collection(COL_ORDERS).doc(orderId);

  await db.runTransaction(async (t) => {
    const snap = await t.get(orderRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'El expediente ya no existe. Actualiza tu lista de órdenes e intenta de nuevo.');
    }
    const orderData = snap.data() || {};
    const items: Array<{ id: string }> = Array.isArray(orderData.items) ? orderData.items : [];

    // Si la OC tiene un solo producto, no hay ambigüedad: se registra el
    // desglose por ítem (igual que hace TabEntregas), evitando el
    // desfase items[]/kilos ya documentado en AUDIT_NOTEBOOK (Iteración
    // 96). Con 2+ productos, Andrés no elige cuál en el Portal (solo ve
    // kilos totales pendientes por OC), así que se usa el campo `kilos`
    // -- el respaldo que el propio tipo `Delivery` ya documenta como
    // válido cuando no hay desglose por ítem.
    const newDelivery: Record<string, unknown> = {
      id: deliveryId,
      date: Timestamp.now(),
      kilos: kilosNum,
      invoiced: false,
      notes: `[Portal Maquilador] ${notes || ''}`.trim(),
      docType: docType || 'remision',
      docFolio: docFolio || null,
    };
    if (items.length === 1) {
      newDelivery.items = [{ itemId: items[0].id, quantity: kilosNum }];
    }

    const currentDeliveries: unknown[] = Array.isArray(orderData.deliveries) ? orderData.deliveries : [];
    t.update(orderRef, {
      deliveries: [...currentDeliveries, newDelivery],
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  // Bitácora propia del portal (estado de cuenta/ledger de Andrés, no
  // depende de esto -- computeAndresBalance() ya lee `purchases`/
  // `expenses`, no `maquilaDeliveries`). Se guarda ya como 'assigned' con
  // referencia a la entrega real: ya no necesita revisión manual, pero
  // queda visible/consultable con el mismo patrón que el resto del
  // sistema usa para trazabilidad de origen.
  const deliveryLogRef = db.collection('maquilaDeliveries').doc();
  await deliveryLogRef.set({
    date: now,
    orderId,
    folio: folio || '',
    productDescription: productDescription || '',
    kilos: kilosNum,
    docType: docType || 'remision',
    docFolio: docFolio || null,
    notes: notes || null,
    status: 'assigned',
    linkedDeliveryId: deliveryId,
    autoImported: true,
    createdAt: now,
  });

  // Bitácora: el portal se accede solo con PIN (sin cuenta/correo por
  // persona), asi que "user" identifica el origen, no a un individuo.
  await db.collection('system_logs').add({
    user: 'portal-maquilador',
    action: 'Entrega Registrada (Portal Maquilador)',
    details: {
      deliveryId,
      orderId,
      folio: folio || '',
      kilos: kilosNum,
      docType: docType || 'remision',
      docFolio: docFolio || null,
    },
    timestamp: now,
  });

  // Notificación Web Push PWA (FCM) a operadores/administradores
  try {
    const tokensSnap = await db.collection('fcm_tokens').limit(50).get();
    const tokens = tokensSnap.docs.map(d => d.data()?.token).filter(Boolean);
    if (tokens.length > 0) {
      const { getMessaging } = await import('firebase-admin/messaging');
      await getMessaging().sendEachForMulticast({
        tokens,
        notification: {
          title: `📦 Entrega Maquila: ${kilosNum.toLocaleString('es-MX')} kg`,
          body: `Andrés registró ${kilosNum} kg para OC-${folio || 'S/F'} (${docType || 'remisión'} ${docFolio || ''})`,
        },
        data: {
          orderId: String(orderId),
          folio: String(folio || ''),
          url: `/orders?id=${orderId}`,
        },
      });
    }
  } catch (fcmErr) {
    logger.warn('Error enviando notificación Push FCM:', fcmErr);
  }

  return { id: deliveryId };
}

export const registrarEntregaMaquila = onCall({ invoker: "public", cors: true, memory: "256MiB", timeoutSeconds: 30 }, async (request) => {
  const db = getFirestore();
  return await procesarRegistroEntregaMaquila(db, request.data);
});

// NUEVO (auditoría v8.9.10, respuesta a la pregunta de si "contrarecibo
// implica entregado ya se refleja en el Portal"): a partir de esta versión
// SÍ, para cualquier entrega confirmada por Andrés desde que el fix de
// v8.9.9 quedó instalado -- `registrarEntregaMaquila` ya escribe directo a
// `deliveries[]`, el mismo campo que gatea tanto `pendingKilos` (este
// portal) como la posibilidad de facturar (`QuickInvoiceModal`), así que
// un expediente con contrarecibo no puede, de aquí en adelante, seguir
// apareciendo como pendiente.
//
// Pero eso NO repara solo lo que quedó atascado ANTES del fix: cualquier
// confirmación que Andrés hizo mientras `registrarEntregaMaquila` todavía
// tenía el bug quedó en `maquilaDeliveries` con `status:'pending'`, sin
// que nadie la haya importado a mano (el botón "Importar" en
// TabEntregas.tsx existe desde antes, pero requiere abrir el expediente
// correcto uno por uno, y ANTES de v8.9.9 ni siquiera funcionaba por el
// bug de `productCode`). Esta función deja resolver ese rezago de forma
// segura desde un solo lugar: NO escribe nada por sí sola -- solo permite
// que un admin, viendo la lista completa, apruebe importar cada entrega
// suelta a su expediente real, una por una. Reutiliza exactamente la
// misma lógica transaccional que `registrarEntregaMaquila` (mismo campo,
// misma forma del tipo `Delivery`), así que el resultado es indistinguible
// de si Andrés la hubiera confirmado hoy.
export const importarEntregaMaquilaPendiente = onCall({ memory: "256MiB", timeoutSeconds: 30 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Inicia sesión.");
  if (!request.auth?.token?.email_verified) throw new HttpsError("permission-denied", "Tu correo debe estar verificado.");

  const db = getFirestore();
  const adminSnap = await db.collection("admins").doc(uid).get();
  if (!adminSnap.exists) throw new HttpsError("permission-denied", "Cuenta no autorizada.");
  const rol = adminSnap.data()?.role;
  if (rol !== "admin" && rol !== "manager") {
    throw new HttpsError("permission-denied", "Tu rol no permite importar entregas.");
  }

  const deliveryLogId = String(request.data?.deliveryLogId ?? "");
  if (!deliveryLogId) throw new HttpsError('invalid-argument', 'Falta deliveryLogId.');

  const logRef = db.collection('maquilaDeliveries').doc(deliveryLogId);
  const logSnap = await logRef.get();
  if (!logSnap.exists) throw new HttpsError('not-found', 'Ese registro de la bitácora ya no existe.');

  const logData = logSnap.data() || {};
  if (logData.status !== 'pending') {
    // Ya se importó (por este camino o por el botón manual de TabEntregas)
    // -- no es un error, es idempotencia: devolvemos éxito sin volver a
    // escribir para que un doble clic o una carrera entre dos admins no
    // duplique la entrega.
    return { ok: true, alreadyAssigned: true };
  }

  const orderId = String(logData.orderId || '');
  if (!orderId) {
    throw new HttpsError('failed-precondition', 'Este registro es de una versión anterior del portal y no guardó a qué expediente pertenece -- impórtalo a mano desde el expediente correcto (pestaña Entregas).');
  }
  const kilosNum = Number(logData.kilos);
  if (!Number.isFinite(kilosNum) || kilosNum <= 0) {
    throw new HttpsError('failed-precondition', 'Este registro no tiene un valor de kilos válido.');
  }

  const deliveryId = randomUUID();
  const orderRef = db.collection(COL_ORDERS).doc(orderId);

  await db.runTransaction(async (t) => {
    const snap = await t.get(orderRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'El expediente al que pertenece esta entrega ya no existe.');
    }
    const data = snap.data() || {};
    const items: Array<{ id: string }> = Array.isArray(data.items) ? data.items : [];

    const newDelivery: Record<string, unknown> = {
      id: deliveryId,
      date: Timestamp.now(),
      kilos: kilosNum,
      invoiced: false,
      notes: `[Portal Maquilador -- importado retroactivo v8.9.10] ${logData.notes || ''}`.trim(),
      docType: logData.docType || 'remision',
      docFolio: logData.docFolio || null,
    };
    if (items.length === 1) {
      newDelivery.items = [{ itemId: items[0].id, quantity: kilosNum }];
    }

    const currentDeliveries: unknown[] = Array.isArray(data.deliveries) ? data.deliveries : [];
    t.update(orderRef, {
      deliveries: [...currentDeliveries, newDelivery],
      updatedAt: FieldValue.serverTimestamp(),
    });
    t.update(logRef, {
      status: 'assigned',
      linkedDeliveryId: deliveryId,
      autoImported: true,
      importedRetroactively: true,
    });
  });

  await db.collection('system_logs').add({
    user: uid,
    action: 'Entrega Pendiente Importada Retroactivamente (Auditoría Portal Maquilador)',
    details: { deliveryLogId, deliveryId, orderId, kilos: kilosNum },
    timestamp: FieldValue.serverTimestamp(),
  });

  return { ok: true, orderId, deliveryId };
});
