import { body, json, route } from "@/lib/api";
import { query } from "@/lib/db";
import { InventoryInput } from "@/lib/schemas";

export const POST = route(async ({ req, user }) => {
  const i = await body(req, InventoryInput);
  const [row] = await query<{ id: string }>(
    "insert into inventory_items (user_id, kind, pillar, text) values ($1,$2,$3,$4) returning id",
    [user.id, i.kind, i.pillar, i.text],
  );
  return json({ id: row.id }, 201);
});
