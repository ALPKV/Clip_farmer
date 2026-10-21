import { body, json, route } from "@/lib/api";
import { query } from "@/lib/db";
import { CarbInput } from "@/lib/schemas";

export const POST = route(async ({ req, user }) => {
  const c = await body(req, CarbInput);
  const [row] = await query<{ id: string }>(
    "insert into carb_logs (user_id, date, meal, carbs_g, timing) values ($1,$2,$3,$4,$5) returning id",
    [user.id, c.date, c.meal, c.carbs_g, c.timing],
  );
  return json({ id: row.id }, 201);
});
