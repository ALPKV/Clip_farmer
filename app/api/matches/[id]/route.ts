import { z } from "zod";
import { body, HttpError, json, route, uuid } from "@/lib/api";
import { query, queryOne } from "@/lib/db";

type P = { id: string };

const Edit = z
  .object({
    dismissal: z.string().trim().max(40),
    dismissal_error: z.string().trim().max(500),
    notes: z.string().trim().max(2000),
  })
  .partial();

/** Edits the written parts of a match (how out, error analysis, notes); figures stay as logged. */
export const PATCH = route<P>(async ({ req, user, params }) => {
  const id = uuid.parse(params.id);
  const e = await body(req, Edit);
  const m = await queryOne<{ batted: boolean; not_out: boolean }>(
    "select batted, not_out from match_logs where id = $1 and user_id = $2",
    [id, user.id],
  );
  if (!m) throw new HttpError(404, "Match not found.");
  if (e.dismissal && (!m.batted || m.not_out)) throw new HttpError(409, "Only an innings that ended in a dismissal can have one.");
  await query(
    `update match_logs set dismissal = coalesce($3, dismissal), dismissal_error = coalesce($4, dismissal_error),
            notes = coalesce($5, notes)
      where id = $1 and user_id = $2`,
    [id, user.id, e.dismissal ?? null, e.dismissal_error ?? null, e.notes ?? null],
  );
  return json({ ok: true });
});

export const DELETE = route<P>(async ({ user, params }) => {
  await query("delete from match_logs where id = $1 and user_id = $2", [uuid.parse(params.id), user.id]);
  return json({ ok: true });
});
