import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, type User } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Refuses state-changing requests sent from other sites (CSRF). */
function checkOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    throw new HttpError(403, "Request refused: it did not come from this site.");
  }
}

type Handler<C> = (ctx: { req: Request; user: User; params: C }) => Promise<Response>;

/** Wraps a route handler: origin check, sign-in check and error handling. */
export function route<C = Record<string, string>>(handler: Handler<C>, { auth = true } = {}) {
  return async (req: Request, ctx: { params: Promise<C> }) => {
    try {
      checkOrigin(req);
      const user = await currentUser();
      if (auth && !user) throw new HttpError(401, "Please sign in.");
      return await handler({ req, user: user as User, params: await ctx.params });
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      if (err instanceof z.ZodError) {
        const issue = err.issues[0];
        return json({ error: `${issue.path.join(".") || "input"}: ${issue.message}` }, 400);
      }
      console.error(err);
      return json({ error: "Something went wrong on the server." }, 500);
    }
  };
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body.");
  }
  return schema.parse(data);
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");
export const uuid = z.string().uuid();
