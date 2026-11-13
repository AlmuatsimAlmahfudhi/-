import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { handler } from "@/server/http";
import { getProfile } from "@/server/game";

const Body = z.object({
  displayName: z.string().min(1).max(40).optional(),
  heroClass: z.enum(["scholar", "warrior", "orator", "ranger"]).optional(),
  dailyGoalXp: z.number().int().min(10).max(1000).optional(),
  activeLang: z.enum(["en", "fr", "es", "zh"]).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const POST = handler(async (req) => {
  const body = Body.parse(await req.json());
  const p = await getProfile();
  const { settings, ...rest } = body;
  await db
    .update(s.profile)
    .set({ ...rest, ...(settings ? { settings: { ...p.settings, ...settings } } : {}) })
    .where(eq(s.profile.id, 1));
  return getProfile();
});
