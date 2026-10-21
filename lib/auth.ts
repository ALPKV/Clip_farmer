import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query, queryOne } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export const SESSION_COOKIE = "flipper_session";
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  weight_kg: number | null;
  season_start: string | null;
  season_end: string | null;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
  return timingSafeEqual(key, expected);
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a session row and sets the sign-in cookie. */
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await query("insert into auth_sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [
    tokenHash(token),
    userId,
    expires.toISOString(),
  ]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await query("delete from auth_sessions where token_hash = $1", [tokenHash(token)]);
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return queryOne<User>(
    `select u.id, u.email, u.name, u.role, u.weight_kg,
            to_char(u.season_start, 'YYYY-MM-DD') as season_start,
            to_char(u.season_end, 'YYYY-MM-DD') as season_end
       from auth_sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [tokenHash(token)],
  );
}

/**
 * Counts an attempt for `key` and returns false once it exceeds `limit` within `windowMin` minutes.
 */
export async function allowAttempt(key: string, limit: number, windowMin: number): Promise<boolean> {
  const row = await queryOne<{ count: number }>(
    `insert into login_attempts (key, count, window_start) values ($1, 1, now())
     on conflict (key) do update set
       count = case when login_attempts.window_start < now() - ($2 || ' minutes')::interval
                    then 1 else login_attempts.count + 1 end,
       window_start = case when login_attempts.window_start < now() - ($2 || ' minutes')::interval
                    then now() else login_attempts.window_start end
     returning count`,
    [key, String(windowMin)],
  );
  return (row?.count ?? 0) <= limit;
}

/** The signed-in user; sends anyone else to the sign-in page. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
