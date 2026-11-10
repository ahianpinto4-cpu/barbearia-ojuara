import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env } from "./env";

/**
 * Acesso ao PostgreSQL (Supabase em produção). Use a connection string do
 * pooler do Supabase em DATABASE_URL. O pool é reaproveitado entre requisições.
 */
export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
};

const globalForDb = globalThis as unknown as { __ojuaraPool?: Pool };

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL não configurada.");
  }
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.databaseUrl);
}

export function getPool(): Pool {
  if (!env.databaseUrl) throw new DatabaseNotConfiguredError();
  if (!globalForDb.__ojuaraPool) {
    const url = env.databaseUrl;
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    globalForDb.__ojuaraPool = new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 10_000,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalForDb.__ojuaraPool;
}

export const db: Queryable = {
  query: (text, params) => getPool().query(text, params as unknown[]) as never,
};

/** Executa `fn` em uma transação. Desfaz tudo em caso de erro. */
export async function withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Erros do Postgres relevantes para a agenda. */
export function pgErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}
export const PG_EXCLUSION_VIOLATION = "23P01";
export const PG_UNIQUE_VIOLATION = "23505";
