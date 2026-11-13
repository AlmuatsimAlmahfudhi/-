import { handler } from "@/server/http";
import { snapshot } from "@/server/game";

export const GET = handler(async () => snapshot());
