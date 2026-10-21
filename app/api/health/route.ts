import { databaseUrl, query } from "@/lib/db";

export async function GET() {
  try {
    await query("select 1");
    return Response.json({ ok: true, database: databaseUrl() ? "postgres" : "local" });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
