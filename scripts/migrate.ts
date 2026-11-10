/**
 * Aplica as migrations de supabase/migrations em ordem (uma única vez cada).
 * Uso: DATABASE_URL=... npm run db:migrate
 *      DATABASE_URL=... npm run db:seed-dev   (migrations + dados FICTÍCIOS de teste)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const client = new Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false } });
  await client.connect();
  await client.query(
    `create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())`,
  );
  await client.query(`alter table public.schema_migrations enable row level security`);
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const done = await client.query(`select 1 from public.schema_migrations where name = $1`, [file]);
    if (done.rowCount) continue;
    process.stdout.write(`→ ${file} ... `);
    await client.query("begin");
    try {
      await client.query(readFileSync(join(dir, file), "utf8"));
      await client.query(`insert into public.schema_migrations (name) values ($1)`, [file]);
      await client.query("commit");
      console.log("ok");
    } catch (err) {
      await client.query("rollback");
      console.log("ERRO");
      throw err;
    }
  }
  if (process.argv.includes("--seed-dev")) {
    if (process.env.APP_ENV === "production") throw new Error("Seed de desenvolvimento bloqueado em produção.");
    await client.query(readFileSync(join(process.cwd(), "supabase", "seed.dev.sql"), "utf8"));
    console.log("→ seed.dev.sql (dados fictícios) ok");
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
