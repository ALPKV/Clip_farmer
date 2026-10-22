import { z } from "zod";
import { endSession, verifyPassword } from "@/lib/auth";
import { body, HttpError, isoDate, json, route } from "@/lib/api";
import { query, queryOne } from "@/lib/db";

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

const DeleteAccount = z.object({ password: z.string().min(1).max(200) });

/** Erases the account and, through the foreign keys, everything it logged. Needs the password. */
export const DELETE = route(async ({ req, user }) => {
  const { password } = await body(req, DeleteAccount);
  const row = await queryOne<{ password_hash: string }>("select password_hash from users where id = $1", [user.id]);
  if (!row || !(await verifyPassword(password, row.password_hash))) throw new HttpError(401, "Password is incorrect.");
  await endSession();
  await query("delete from users where id = $1", [user.id]);
  await query("delete from login_attempts where key = $1", [`login:${user.email}`]);
  return json({ ok: true });
});
