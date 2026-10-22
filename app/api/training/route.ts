import { z } from "zod";
import { body, HttpError, json, route } from "@/lib/api";
import { query, queryOne } from "@/lib/db";
import { FEATURE_COUNT } from "@/lib/tracking/model";

/**
 * Opt-in training data for the ball model. Only numbers arrive here: for each moving spot the
 * tracker looked at, its 168 features (shape, a 9×9 grey square around it, its motion) and whether
 * the player said it was the ball. Never video, frames, file names or times.
 */

/** Per player per day, and in total, so the free database never fills up. */
const DAILY_LIMIT = 5000;
const TOTAL_LIMIT = 300_000;

const Sample = z.object({
  label: z.union([z.literal(0), z.literal(1)]),
  features: z.array(z.number().finite().min(-1e4).max(1e4)).length(FEATURE_COUNT),
});

const Upload = z.object({
  source: z.enum(["confirmed", "rejected"]),
  frame_w: z.number().int().min(16).max(4000),
  frame_h: z.number().int().min(16).max(4000),
  fps: z.number().min(1).max(1000),
  model_version: z.string().max(20),
  samples: z.array(Sample).min(1).max(200),
});

export const GET = route(async ({ user }) => {
  const row = await queryOne<{ n: number }>("select count(*)::int as n from training_samples where user_id = $1", [user.id]);
  return json({ share: user.share_training, shared: row?.n ?? 0 });
});

export const POST = route(async ({ req, user }) => {
  if (!user.share_training) throw new HttpError(403, "Turn on sharing in your Profile first.");
  const u = await body(req, Upload);
  const today = await queryOne<{ n: number }>(
    "select count(*)::int as n from training_samples where user_id = $1 and created_at > now() - interval '1 day'",
    [user.id],
  );
  if ((today?.n ?? 0) + u.samples.length > DAILY_LIMIT) throw new HttpError(429, "That's plenty for today, thanks. Try again tomorrow.");
  const total = await queryOne<{ n: number }>("select count(*)::int as n from training_samples");
  if ((total?.n ?? 0) + u.samples.length > TOTAL_LIMIT) throw new HttpError(503, "The training set is full for now. Thanks anyway!");
  const rows = u.samples.map((s) => ({ label: s.label, features: s.features.map((v) => Math.round(v * 1e4) / 1e4) }));
  await query(
    `insert into training_samples (user_id, label, source, features, frame_w, frame_h, fps, model_version)
     select $1, x.label, $2, x.features, $3, $4, $5, $6
       from jsonb_to_recordset($7::jsonb) as x(label smallint, features real[])`,
    [user.id, u.source, u.frame_w, u.frame_h, u.fps, u.model_version, JSON.stringify(rows)],
  );
  return json({ ok: true, added: rows.length }, 201);
});

const Setting = z.object({ share: z.boolean(), deleteShared: z.boolean().optional() });

/** Turns sharing on or off; turning it off can also delete everything shared so far. */
export const PATCH = route(async ({ req, user }) => {
  const s = await body(req, Setting);
  await query("update users set share_training = $2 where id = $1", [user.id, s.share]);
  if (!s.share && s.deleteShared) await query("delete from training_samples where user_id = $1", [user.id]);
  return json({ ok: true });
});
