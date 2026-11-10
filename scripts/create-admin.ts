/**
 * Cria (ou redefine a senha de) um usuário do painel.
 * Uso: DATABASE_URL=... npm run admin:create -- email@exemplo.com "Nome" [owner|staff]
 * A senha é pedida no terminal (não fica no histórico do shell).
 */
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";
import { Client } from "pg";

/** Mesmo formato de src/lib/server/auth.ts (scrypt$salt$hash). */
async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = (await promisify(scrypt)(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function main() {
  const [email, name, role = "owner"] = process.argv.slice(2);
  if (!email || !name) throw new Error('Uso: npm run admin:create -- email@exemplo.com "Nome" [owner|staff]');
  if (!["owner", "staff"].includes(role)) throw new Error("Papel deve ser owner ou staff.");
  const password =
    process.env.ADMIN_PASSWORD ??
    (await createInterface({ input: process.stdin, output: process.stdout }).question("Senha (mín. 10 caracteres): "));
  if (password.length < 10) throw new Error("A senha precisa ter pelo menos 10 caracteres.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const client = new Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false } });
  await client.connect();
  await client.query(
    `insert into admin_users (email, name, role, password_hash) values ($1, $2, $3, $4)
     on conflict (email) do update set name = excluded.name, role = excluded.role,
       password_hash = excluded.password_hash, active = true`,
    [email.toLowerCase(), name, role, await hashPassword(password)],
  );
  await client.end();
  console.log(`Usuário ${email} pronto.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
