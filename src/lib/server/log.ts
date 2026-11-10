import { db, isDatabaseConfigured } from "./db";

type Level = "debug" | "info" | "warn" | "error";

/** Registro de eventos: console + tabela event_logs (sem dados sensíveis). */
export async function logEvent(level: Level, type: string, message: string, data?: Record<string, unknown>) {
  const line = `[${level}] ${type}: ${message}`;
  if (level === "error") console.error(line, data ?? "");
  else if (level === "warn") console.warn(line, data ?? "");
  else if (process.env.NODE_ENV !== "test") console.log(line);
  if (!isDatabaseConfigured()) return;
  try {
    await db.query("insert into event_logs (level, type, message, data) values ($1, $2, $3, $4)", [
      level,
      type,
      message.slice(0, 2000),
      data ? JSON.stringify(data) : null,
    ]);
  } catch (err) {
    console.error("[log] falha ao gravar evento", err);
  }
}

/** Mascara telefone para logs: 5579******5023 */
export function maskPhone(phone: string): string {
  return phone.length > 8 ? `${phone.slice(0, 4)}${"*".repeat(phone.length - 8)}${phone.slice(-4)}` : "****";
}
