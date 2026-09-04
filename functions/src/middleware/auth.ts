import type { CallableRequest } from "firebase-functions/v2/https";
import { AuthenticationError } from "./errorHandler";

export function ensureAuthenticated(request: CallableRequest<unknown>): string {
  if (!request.auth?.uid) {
    throw new AuthenticationError("Debes iniciar sesión para ejecutar esta acción.");
  }
  return request.auth.uid;
}
