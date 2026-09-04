import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI, Type } from "@google/genai";
import { getFirestore } from "firebase-admin/firestore";

export const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Función interna reutilizable para extraer datos estructurados usando Gemini 2.5 Flash.
 */
export async function extractDocumentData(base64: string, mimeType: string, apiKey?: string) {
  const key = apiKey || geminiApiKey.value();
  const ai = new GoogleGenAI({ apiKey: key });

  const prompt = `
    Eres un asistente experto en auditoría contable y extracción de datos comerciales para la industria textil (Grupo Textil Providencia / Textil Hogar).
    Analiza este documento (puede ser una Factura, Orden de Compra oficial, Contrarecibo o Remisión).
    Extrae la información financiera y operativa solicitada con máxima precisión.
    
    REGLAS ESTRICTAS DE EXTRACCIÓN:
    1. Para Órdenes de Compra (OC):
       - 'oc': Extrae el número oficial largo de 11 dígitos que aparece en 'CDB OC: XXXXXXXXXXX' o bajo 'Orden de Compra' (Ejemplo: '12026439713' o '120267114114'). NUNCA uses el nombre del archivo.
       - 'folio': Extrae el folio interno de compra que aparece en 'No. Ord. de Compra:' (Ejemplo: '43/9713' o '71/14114').
       - 'departamento': Identifica si es 'TH' (Textil Hogar / TH-ALMACEN-1 / José Nava) o 'GT' (Grupo Textil / P4-ALM / Evelia).
    2. Partidas / Conceptos: Extrae cada renglón con su código de SKU (ej. 'EGBO000095-SC'), descripción, cantidad de kilos (ej. 1000.0), precio unitario (ej. 43.0) e importe.
    3. Kilos Totales: Suma todas las cantidades de las partidas y asígnalas a 'kilosTotales'.
    4. Formato Numérico: Devuelve los montos crudos, sin signos de moneda ($) ni comas separadoras de miles. Ejemplo: 159100.00
    5. Fechas: Formato YYYY-MM-DD.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: base64,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tipoDocumento: { 
            type: Type.STRING, 
            description: "Clasificación del documento: orden_compra, factura, contrarecibo, remision, otro" 
          },
          oc: {
            type: Type.STRING,
            description: "Número largo oficial de 11 dígitos de la OC (ej. 12026439713 de 'CDB OC: 12026439713')"
          },
          folio: { 
            type: Type.STRING, 
            description: "Folio interno corto (ej. 43/9713 de 'No. Ord. de Compra:') o folio de factura" 
          },
          departamento: {
            type: Type.STRING,
            description: "TH para Textil Hogar / Nava / Almacén 1, o GT para Grupo Textil / Evelia / P4"
          },
          contrarecibo: {
            type: Type.STRING,
            description: "Número de contrarecibo con prefijo TH- o GT- si existe"
          },
          fecha: { 
            type: Type.STRING, 
            description: "Fecha del pedido/emisión en formato YYYY-MM-DD" 
          },
          fechaEntrega: {
            type: Type.STRING,
            description: "Fecha de entrega programada en formato YYYY-MM-DD"
          },
          entidad: { 
            type: Type.STRING, 
            description: "Nombre del cliente o razón social" 
          },
          subtotal: { 
            type: Type.NUMBER, 
            description: "Subtotal antes de impuestos" 
          },
          iva: { 
            type: Type.NUMBER, 
            description: "Monto total de IVA" 
          },
          total: { 
            type: Type.NUMBER, 
            description: "Total neto" 
          },
          kilosTotales: {
            type: Type.NUMBER,
            description: "Suma total de kilos o unidades pedidas"
          },
          conceptos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                codigo: { type: Type.STRING, description: "Código de artículo o SKU (ej. EGBO000095-SC)" },
                descripcion: { type: Type.STRING },
                cantidad: { type: Type.NUMBER },
                precioUnitario: { type: Type.NUMBER },
                importe: { type: Type.NUMBER }
              }
            }
          }
        }
      }
    },
  });

  const jsonText = response.text;
  if (!jsonText) throw new Error("Respuesta vacía del modelo");

  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error("El modelo devolvió un JSON inválido, no se puede procesar el documento.");
  }

  return sanitizeExtractedData(parsed);
}

/**
 * FIX (auditoría 2026-09-03): antes, lo que devolvía Gemini se regresaba
 * tal cual —sin ninguna validación de tipos— al cliente, que a su vez lo
 * guarda en Firestore como parte de un expediente financiero real. La
 * documentación del sistema (docs/SISTEMA_ACTUAL.md) afirma que existe
 * "validación de Zod"; no existía en este archivo. Esta función es el
 * mínimo necesario: obliga a que los campos numéricos sean números finitos
 * (nunca strings tipo "cuarenta y tres mil") y a que 'conceptos' sea
 * siempre un arreglo, sin inventar valores que el modelo no dio.
 */
function sanitizeExtractedData(data: any): any {
  const toFiniteNumberOrUndefined = (val: unknown): number | undefined => {
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (typeof val === "string") {
      const cleaned = val.replace(/[^0-9.\-]/g, "");
      const n = Number(cleaned);
      if (Number.isFinite(n) && cleaned.length > 0) return n;
    }
    return undefined;
  };

  const safe = { ...data };

  for (const field of ["subtotal", "iva", "total", "kilosTotales"] as const) {
    if (field in safe) {
      const n = toFiniteNumberOrUndefined(safe[field]);
      safe[field] = n; // undefined si no era convertible — mejor faltante que corrupto
    }
  }

  if ("conceptos" in safe) {
    safe.conceptos = Array.isArray(safe.conceptos)
      ? safe.conceptos.map((c: any) => ({
          ...c,
          cantidad: toFiniteNumberOrUndefined(c?.cantidad),
          precioUnitario: toFiniteNumberOrUndefined(c?.precioUnitario),
          importe: toFiniteNumberOrUndefined(c?.importe),
        }))
      : [];
  }

  return safe;
}

/**
 * Lector Inteligente Universal Callable
 */
export const parseDocumentData = onCall(
  { secrets: [geminiApiKey], memory: "512MiB", timeoutSeconds: 60 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Debe estar autenticado para usar el lector inteligente.");
    }
    if (!request.auth?.token?.email_verified) {
      throw new HttpsError("permission-denied", "Tu correo debe estar verificado.");
    }
    const db = getFirestore();
    const adminSnap = await db.collection("admins").doc(uid).get();
    const rol = adminSnap.data()?.role;
    if (!adminSnap.exists || (rol !== "admin" && rol !== "manager")) {
      throw new HttpsError("permission-denied", "Tu cuenta no tiene permiso para usar el lector inteligente.");
    }

    const { base64, mimeType } = request.data;
    
    if (!base64 || !mimeType) {
      throw new HttpsError("invalid-argument", "Se requiere 'base64' y 'mimeType'.");
    }

    try {
      return await extractDocumentData(base64, mimeType, geminiApiKey.value());
    } catch (error: any) {
      console.error("Error en parseDocumentData:", error);
      throw new HttpsError("internal", "No se pudo procesar el documento con IA: " + error.message);
    }
  }
);
