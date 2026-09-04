export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends Error {
  constructor(message = "No autorizado") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function handleFunctionError(error: unknown): { status: number; error: string } {
  if (error instanceof ValidationError) {
    return { status: 400, error: error.message };
  }
  if (error instanceof AuthenticationError) {
    return { status: 401, error: error.message };
  }
  const msg = error instanceof Error ? error.message : "Error interno del servidor";
  return { status: 500, error: msg };
}
