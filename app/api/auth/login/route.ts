import { z } from "zod";
import { allowAttempt, startSession, verifyPassword } from "@/lib/auth";
import { body, HttpError, json, route } from "@/lib/api";
import { queryOne } from "@/lib/db";

const Login = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const POST = route(
  async ({ req }) => {
    const { email, password } = await body(req, Login);
    if (!(await allowAttempt(`login:${email}`, 8, 15))) {
      throw new HttpError(429, "Too many attempts. Wait 15 minutes and try again.");
    }
    const user = await queryOne<{ id: string; password_hash: string }>(
      "select id, password_hash from users where email = $1",
      [email],
    );
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new HttpError(401, "Email or password is incorrect.");
    }
    await startSession(user.id);
    return json({ ok: true });
  },
  { auth: false },
);
