import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
// NOTA (2026-08-11): "@google/genai" se importaba arriba, a nivel de
// modulo -- eso obliga a Node a cargar el SDK completo (y sus
// dependencias transitivas: google-auth-library, etc.) apenas se
// requiere este archivo, ANTES de que arranque la funcion. El comando
// `firebase deploy --only functions` primero hace una fase de
// "descubrimiento" que carga TODO el codigo de functions/ solo para leer
// la configuracion de cada funcion (no para ejecutarlas) -- y esa fase
// tiene un limite de 10 segundos por defecto. Con el import a nivel de
// modulo, cargar este SDK pesado contaba contra ese limite de 10s aunque
// nadie estuviera usando el lector de IA en ese momento, causando el
// error "Cannot determine backend specification. Timeout after 10000"
// que reporto el usuario. Solucion oficial de Firebase para este caso
// exacto (ver la URL del propio mensaje de error): mover el import
// pesado a DENTRO del handler con un import dinamico, para que solo se
// cargue cuando la funcion de verdad se ejecuta, no durante el
// descubrimiento del deploy.
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Lector Inteligente Universal
 * Recibe un archivo en Base64 (PDF o Imagen) y usa Gemini 2.5 Flash
 * para extraer los campos clave estructurados garantizados por schema.
 */
export const parseDocumentData = onCall(
  { secrets: [geminiApiKey], memory: "512MiB", timeoutSeconds: 60, region: "us-central1" },
  async (request) => {
    // Solo usuarios autenticados pueden usar esto
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debe estar autenticado para usar el lector inteligente.");
    }

    const { base64, mimeType } = request.data;
    
    if (!base64 || !mimeType) {
      throw new HttpsError("invalid-argument", "Se requiere 'base64' y 'mimeType'.");
    }

    // Import dinamico: el SDK pesado solo se carga aqui, en tiempo de
    // ejecucion real de la funcion (ver nota arriba).
    const { GoogleGenAI, Type } = await import("@google/genai");

    // Inicializar el SDK con la llave inyectada de Google Cloud Secret Manager
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    try {
      const prompt = `
        Eres un asistente experto en auditoría contable y extracción de datos comerciales.
        Analiza este documento (puede ser una Factura, Orden de Compra, Remisión o Ticket).
        Extrae la información financiera solicitada con máxima precisión.
        
        REGLAS ESTRICTAS:
        1. Formato Numérico: Devuelve los montos crudos, sin signos de moneda ($) ni comas separadoras de miles. Ejemplo correcto: 12500.50
        2. Clasificación: Infiere si es una 'factura', 'oc' (orden de compra), o 'remision'.
        3. Kilos/Bultos: Si el documento es una nota de entrega o factura de plástico/bolsas, extrae el peso total en kilos y ponlo en 'kilosTotales'.
        4. Impuestos: Extrae el IVA exacto. Si no está desglosado pero dice "IVA Incluido", no lo calcules, pon 0 en IVA y el total en Total.
        5. Campos Faltantes: Si algún dato simplemente no viene en el PDF, devuélvelo como nulo o 0. ¡No inventes datos!
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
                description: "Clasificación del documento: factura, oc, remision, otro" 
              },
              folio: { 
                type: Type.STRING, 
                description: "Número de folio del documento o UUID corto" 
              },
              fecha: { 
                type: Type.STRING, 
                description: "Fecha del documento en formato YYYY-MM-DD" 
              },
              entidad: { 
                type: Type.STRING, 
                description: "Nombre del proveedor o cliente" 
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
                description: "Si se mencionan pesos en kg, la suma total de kilos (o de cantidad de bultos si son bolsas)"
              },
              conceptos: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
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
      
      const parsed = JSON.parse(jsonText);
      return parsed;

    } catch (error: any) {
      console.error("Error en parseDocumentData:", error);
      throw new HttpsError("internal", "No se pudo procesar el documento con IA: " + error.message);
    }
  }
);
