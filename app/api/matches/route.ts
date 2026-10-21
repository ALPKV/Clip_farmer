import { body, json, route } from "@/lib/api";
import { query } from "@/lib/db";
import { Match } from "@/lib/schemas";

export const POST = route(async ({ req, user }) => {
  const m = await body(req, Match);
  const out = m.batted && !m.not_out;
  const [row] = await query<{ id: string }>(
    `insert into match_logs (user_id, date, opponent, format, batted, runs, balls_faced, not_out, dismissal,
       dismissal_error, balls_bowled, runs_conceded, wickets, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
    [
      user.id,
      m.date,
      m.opponent,
      m.format,
      m.batted,
      m.batted ? m.runs : 0,
      m.batted ? m.balls_faced : 0,
      m.batted && m.not_out,
      out ? m.dismissal : "",
      m.dismissal_error,
      m.balls_bowled,
      m.balls_bowled > 0 ? m.runs_conceded : 0,
      m.balls_bowled > 0 ? m.wickets : 0,
      m.notes,
    ],
  );
  return json({ id: row.id }, 201);
});
