import { z } from "zod";
import { body, HttpError, json, route, uuid } from "@/lib/api";
import { query, queryOne } from "@/lib/db";

type P = { id: string };

const Update = z.object({ manual_current: z.number().min(0).max(1_000_000) });

/** Only the progress of a custom goal can change; targets stay as set at the start (PRD: goal realism). */
export const PATCH = route<P>(async ({ req, user, params }) => {
  const id = uuid.parse(params.id);
  const { manual_current } = await body(req, Update);
  const g = await queryOne<{ metric: string }>("select metric from goals where id = $1 and user_id = $2", [id, user.id]);
  if (!g) throw new HttpError(404, "Goal not found.");
  if (g.metric !== "custom") throw new HttpError(409, "This goal updates automatically from your logs.");
  await query("update goals set manual_current = $3 where id = $1 and user_id = $2", [id, user.id, manual_current]);
  return json({ ok: true });
});

export const DELETE = route<P>(async ({ user, params }) => {
  await query("delete from goals where id = $1 and user_id = $2", [uuid.parse(params.id), user.id]);
  return json({ ok: true });
});
