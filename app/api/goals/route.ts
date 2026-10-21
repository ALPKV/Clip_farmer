import { body, HttpError, json, route } from "@/lib/api";
import { query } from "@/lib/db";
import { GoalInput } from "@/lib/schemas";

export const POST = route(async ({ req, user }) => {
  const g = await body(req, GoalInput);
  if (g.season_end <= g.season_start) throw new HttpError(400, "The season must end after it starts.");
  if (g.baseline >= g.target) throw new HttpError(400, "The target must be above where you start.");
  const [row] = await query<{ id: string }>(
    `insert into goals (user_id, title, metric, unit, target, baseline, season_start, season_end)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [user.id, g.title, g.metric, g.unit, g.target, g.baseline, g.season_start, g.season_end],
  );
  return json({ id: row.id }, 201);
});
