import { handler } from "@/server/http";
import { aiEnabled, aiSettings } from "@/server/ai";

export const GET = handler(async () => ({ enabled: aiEnabled(), ...(await aiSettings()) }));
