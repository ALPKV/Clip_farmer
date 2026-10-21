import { body, json, route } from "@/lib/api";
import { query } from "@/lib/db";
import { DeliveryInput } from "@/lib/schemas";

export const POST = route(async ({ req, user }) => {
  const d = await body(req, DeliveryInput);
  const [row] = await query<{ id: string }>(
    `insert into deliveries (user_id, date, speed_kmh, length_m, line_cm, video_name, clip_time, method)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [user.id, d.date, d.speed_kmh, d.length_m, d.line_cm, d.video_name, d.clip_time, d.method],
  );
  return json({ id: row.id }, 201);
});
