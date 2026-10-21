import "server-only";
import postgres from "postgres";
import { SCHEMA_SQL } from "./schema";

/**
 * Database access.
 *
 * Production (Vercel): DATABASE_URL points at Neon Postgres, added by the Neon integration.
 * Local development: with no DATABASE_URL, an embedded Postgres (PGlite) stores data in ./.data.
 */

type Row = Record<string, unknown>;
type Runner = (text: string, params: unknown[]) => Promise<Row[]>;

// One connection per server process, shared by every route bundle (dev builds load this module
// more than once, and two embedded databases on the same folder would not see each other's writes).
const shared = globalThis as typeof globalThis & { __flipperDb?: Promise<Runner> | null };

/**
 * The Postgres URL. Vercel's Neon integration names it DATABASE_URL by default, but a custom
 * prefix in the "Connect" dialog gives names like STORAGE_DATABASE_URL, so accept those too.
 */
export function databaseUrl(): string | undefined {
  const env = process.env;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.POSTGRES_URL) return env.POSTGRES_URL;
  const key = Object.keys(env)
    .filter((k) => /(DATABASE|POSTGRES)_URL$/.test(k) && !/UNPOOLED|NON_POOLING/.test(k))
    .sort()
    .find((k) => /^postgres(ql)?:\/\//.test(env[k] ?? ""));
  return key ? env[key] : undefined;
}

async function connect(): Promise<Runner> {
  const url = databaseUrl();
  if (url) {
    // prepare:false works with Neon's pooled (PgBouncer) connection string.
    const sql = postgres(url, { max: 3, prepare: false, idle_timeout: 20, ssl: "require" });
    const run: Runner = async (text, params) =>
      (await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as Row[];
    await sql.unsafe(SCHEMA_SQL);
    return run;
  }
  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is not set. In Vercel: Storage → Create Database → Neon → connect it to this project, then redeploy.",
    );
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("node:fs");
  mkdirSync("./.data", { recursive: true });
  const db = new PGlite("./.data/pglite");
  await db.exec(SCHEMA_SQL);
  return async (text, params) => (await db.query<Row>(text, params)).rows;
}

/** Runs one parameterised statement ($1, $2, …) and returns its rows. */
export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!shared.__flipperDb) {
    shared.__flipperDb = connect().catch((err) => {
      shared.__flipperDb = null;
      throw err;
    });
  }
  const run = await shared.__flipperDb;
  return (await run(text, params)) as T[];
}

export async function queryOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
