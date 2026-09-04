export type LogLevel = "info" | "warn" | "error" | "debug";

export function logStructured(level: LogLevel, message: string, data?: unknown): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data !== undefined ? { data } : {}),
  };
  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else if (level === "warn") {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

export const loggerPro = {
  info: (msg: string, data?: unknown) => logStructured("info", msg, data),
  warn: (msg: string, data?: unknown) => logStructured("warn", msg, data),
  error: (msg: string, data?: unknown) => logStructured("error", msg, data),
  debug: (msg: string, data?: unknown) => logStructured("debug", msg, data),
};
