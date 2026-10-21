import { z } from "zod";
import { allowAttempt, hashPassword, startSession } from "@/lib/auth";
import { body, HttpError, json, route } from "@/lib/api";
import { query, queryOne } from "@/lib/db";

const Signup = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10, "use at least 10 characters").max(200),
});

export const POST = route(
  async ({ req }) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!(await allowAttempt(`signup:${ip}`, 10, 60))) throw new HttpError(429, "Too many sign-ups. Try again later.");
    const { name, email, password } = await body(req, Signup);
    if (await queryOne("select 1 from users where email = $1", [email])) {
      throw new HttpError(409, "An account with that email already exists.");
    }
    const [user] = await query<{ id: string }>(
      "insert into users (name, email, password_hash) values ($1, $2, $3) returning id",
      [name, email, await hashPassword(password)],
    );
    await startSession(user.id);
    return json({ ok: true }, 201);
  },
  { auth: false },
);
