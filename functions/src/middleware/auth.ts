import type { CallableRequest } from "firebase-functions/v2/https";
import { auth } from "../utils/firebase";
import { AuthenticationError } from "./errorHandler";

// ────────────────────────────────────────────────────────────────────────────
// ensureAuthenticated — para Cloud Functions callable (onCall).
// Lanza AuthenticationError si el request no lleva uid de Firebase Auth.
// ────────────────────────────────────────────────────────────────────────────
export function ensureAuthenticated(request: CallableRequest<unknown>): string {
  if (!request.auth?.uid) {
    throw new AuthenticationError("Debes iniciar sesión para ejecutar esta acción.");
  }
  return request.auth.uid;
}

// ────────────────────────────────────────────────────────────────────────────
// validateAuth — middleware para handlers HTTP (onRequest / Express-style).
//
// Verifica el Bearer token en el header Authorization usando Firebase Admin Auth.
// Si es válido, adjunta `req.user` con el DecodedIdToken y llama al handler.
// Si es inválido, responde con 401 o 403 sin llamar al handler.
//
// Uso:
//   export const myEndpoint = onRequest({ region: "us-east1" },
//     validateAuth(async (req, res) => { ... })
//   );
// ────────────────────────────────────────────────────────────────────────────
export function validateAuth<Req extends { headers?: Record<string, string | string[] | undefined>; user?: unknown }, Res extends { status: (code: number) => { json: (body: unknown) => void } }>(
  handler: (req: Req, res: Res) => Promise<void> | void,
) {
  return async (req: Req, res: Res) => {
    const authHeader = req.headers?.["authorization"];
    const headerStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const token = headerStr?.startsWith("Bearer ") ? headerStr.split("Bearer ")[1] : undefined;

    if (!token) {
      res.status(401).json({ error: "No autorizado: falta el token Bearer." });
      return;
    }

    try {
      const decoded = await auth.verifyIdToken(token);
      req.user = decoded;
      return handler(req, res);
    } catch {
      res.status(403).json({ error: "Token inválido o expirado." });
    }
  };
}
