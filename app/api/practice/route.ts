import { body, HttpError, json, route } from "@/lib/api";
import { query } from "@/lib/db";
import { logWindowError } from "@/lib/domain";
import { NewPractice } from "@/lib/schemas";

/** Plans a session, or logs a finished one (the PRD's 2-hour logging rule applies). */
export const POST = route(async ({ req, user }) => {
  const s = await body(req, NewPractice);
  const c = s.completion;
  if (c) {
    const err = logWindowError(new Date(c.completed_at));
    if (err) throw new HttpError(422, err);
  }
  const [row] = await query<{ id: string }>(
    `insert into practice_sessions
       (user_id, date, category, title, status, planned_minutes, duration_min, rpe, intent, reflection,
        details, completed_at, logged_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13) returning id`,
    [
      user.id,
      s.date,
      s.category,
      s.title,
      c ? "completed" : "planned",
      s.planned_minutes,
      c?.duration_min ?? null,
      c?.rpe ?? null,
      s.intent,
      c?.reflection ?? "",
      JSON.stringify({ ...s.details, ...(c?.details ?? {}) }),
      c?.completed_at ?? null,
      c ? new Date().toISOString() : null,
    ],
  );
  return json({ id: row.id }, 201);
});
