import { z } from "zod";
import { isLang } from "@/content";
import { handler } from "@/server/http";
import { dueCards, reviewCard } from "@/server/srs";

export const GET = handler(async (req) => {
  const lang = new URL(req.url).searchParams.get("lang");
  return dueCards(lang && isLang(lang) ? lang : null, 40);
});

const Body = z.object({ cardId: z.string(), rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) });
export const POST = handler(async (req) => {
  const b = Body.parse(await req.json());
  return reviewCard(b.cardId, b.rating);
});
