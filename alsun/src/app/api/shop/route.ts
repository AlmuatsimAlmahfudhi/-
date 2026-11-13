import { z } from "zod";
import { handler } from "@/server/http";
import { buyItem, consumeItem } from "@/server/game";

const Body = z.object({ item: z.enum(["streak_freeze", "xp_boost", "boss_potion"]), action: z.enum(["buy", "use"]).default("buy") });

export const POST = handler(async (req) => {
  const b = Body.parse(await req.json());
  if (b.action === "use") return { ok: await consumeItem(b.item) };
  return buyItem(b.item);
});
