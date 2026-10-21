import { json, route, uuid } from "@/lib/api";
import { query } from "@/lib/db";

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await query("delete from deliveries where id = $1 and user_id = $2", [uuid.parse(params.id), user.id]);
  return json({ ok: true });
});
