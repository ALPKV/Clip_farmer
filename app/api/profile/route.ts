import { z } from "zod";
import { body, isoDate, json, route } from "@/lib/api";
import { query } from "@/lib/db";

const Profile = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.enum(["batter", "bowler", "all-rounder", "wicketkeeper"]),
  weight_kg: z.number().min(25).max(200).nullable(),
  season_start: isoDate.nullable(),
  season_end: isoDate.nullable(),
});

export const PATCH = route(async ({ req, user }) => {
  const p = await body(req, Profile);
  await query(
    "update users set name = $2, role = $3, weight_kg = $4, season_start = $5, season_end = $6 where id = $1",
    [user.id, p.name, p.role, p.weight_kg, p.season_start, p.season_end],
  );
  return json({ ok: true });
});
