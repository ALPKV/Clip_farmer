import { body, HttpError, json, route, uuid } from "@/lib/api";
import { query, queryOne } from "@/lib/db";
import { logWindowError } from "@/lib/domain";
import { Completion } from "@/lib/schemas";

type P = { id: string };

/** Completes a planned session (the PRD's 2-hour logging rule applies). */
export const PATCH = route<P>(async ({ req, user, params }) => {
  const id = uuid.parse(params.id);
  const c = await body(req, Completion);
  const s = await queryOne<{ status: string; details: Record<string, unknown> }>(
    "select status, details from practice_sessions where id = $1 and user_id = $2",
    [id, user.id],
  );
  if (!s) throw new HttpError(404, "Session not found.");
  if (s.status === "completed") throw new HttpError(409, "This session is already logged.");
  const err = logWindowError(new Date(c.completed_at));
  if (err) throw new HttpError(422, err);
  await query(
    `update practice_sessions set status = 'completed', duration_min = $3, rpe = $4, reflection = $5,
            completed_at = $6, logged_at = now(), details = $7::jsonb
      where id = $1 and user_id = $2`,
    [id, user.id, c.duration_min, c.rpe, c.reflection, c.completed_at, JSON.stringify({ ...s.details, ...(c.details ?? {}) })],
  );
  return json({ ok: true });
});

export const DELETE = route<P>(async ({ user, params }) => {
  await query("delete from practice_sessions where id = $1 and user_id = $2", [uuid.parse(params.id), user.id]);
  return json({ ok: true });
});
