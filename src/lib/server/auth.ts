import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { env } from "./env";
import { logEvent } from "./log";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "ojuara_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 h

/* ------------------------------ Senhas ------------------------------ */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const hash = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}

/* ------------------------------ Sessão ------------------------------ */

export type AdminSession = { uid: string; email: string; name: string; role: "owner" | "staff"; exp: number };

function secret(): string {
  if (!env.sessionSecret || env.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET ausente ou curta (mínimo 32 caracteres).");
  }
  return env.sessionSecret;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(s: AdminSession): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): AdminSession | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as AdminSession;
    return s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}

/** Verifica credenciais com proteção contra força bruta (5 tentativas / 15 min por e-mail). */
export async function login(emailRaw: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = emailRaw.trim().toLowerCase();
  const { rows: fails } = await db.query<{ n: string }>(
    `select count(*) as n from event_logs where type = 'auth.failed' and data->>'email' = $1 and created_at > now() - interval '15 minutes'`,
    [email],
  );
  if (Number(fails[0]?.n ?? 0) >= 5) return { ok: false, error: "Muitas tentativas. Aguarde 15 minutos." };

  const { rows } = await db.query<{ id: string; email: string; name: string; role: "owner" | "staff"; password_hash: string; active: boolean }>(
    `select id, email, name, role, password_hash, active from admin_users where email = $1`,
    [email],
  );
  const user = rows[0];
  // Compara mesmo quando o usuário não existe (tempo de resposta uniforme).
  const valid = await verifyPassword(password, user?.password_hash ?? "scrypt$00$00");
  if (!user || !user.active || !valid) {
    await logEvent("warn", "auth.failed", "Login inválido", { email });
    return { ok: false, error: "E-mail ou senha incorretos." };
  }
  await db.query(`update admin_users set last_login_at = now() where id = $1`, [user.id]);
  const session: AdminSession = {
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  (await cookies()).set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  await logEvent("info", "auth.login", "Login no painel", { email });
  return { ok: true };
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<AdminSession | null> {
  const s = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return null;
  // Confere se o usuário continua ativo.
  const { rows } = await db.query(`select 1 from admin_users where id = $1 and active`, [s.uid]);
  return rows[0] ? s : null;
}

/** Use em todas as páginas e ações do painel. */
export async function requireAdmin(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  return s;
}
