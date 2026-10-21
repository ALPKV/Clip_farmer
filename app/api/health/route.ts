import { query } from "@/lib/db";

export async function GET() {
  try {
    await query("select 1");
    return Response.json({ ok: true, database: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ? "postgres" : "local" });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
