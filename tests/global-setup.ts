import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

/** Recria o banco de teste e aplica todas as migrations. */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:54329/ojuara_test");
  const dbName = url.pathname.slice(1);
  const admin = new Client({ connectionString: url.toString().replace(`/${dbName}`, "/postgres") });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await client.query(readFileSync(join(dir, f), "utf8"));
  }
  await client.end();
}
