import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI, Type } from "@google/genai";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Lector Inteligente Universal
 * Recibe un archivo en Base64 (PDF o Imagen) y usa Gemini 2.5 Flash
 * para extraer los campos clave estructurados garantizados por schema.
 */
export const parseDocumentData = onCall(
  { secrets: [geminiApiKey], memory: "512MiB", timeoutSeconds: 60 },
  async (request) => {
    // Solo usuarios autenticados pueden usar esto
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debe estar autenticado para usar el lector inteligente.");
    }

    const { base64, mimeType } = request.data;
    
    if (!base64 || !mimeType) {
      throw new HttpsError("invalid-argument", "Se requiere 'base64' y 'mimeType'.");
    }

    // Inicializar el SDK con la llave inyectada de Google Cloud Secret Manager
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    try {
      const prompt = `
        Analiza este documento comercial (puede ser una Factura, una Orden de Compra o una Nota/Remisión).
        Extrae la información financiera solicitada.
        Si algún campo no está presente en el documento, devuélvelo como nulo, vacío o 0 según corresponda.
        Asegúrate de que los montos numéricos no tengan comas ni signos de dólar, solo el número crudo.
        Trata de inferir si es una 'factura', 'oc' (orden de compra) o 'remision'.
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
