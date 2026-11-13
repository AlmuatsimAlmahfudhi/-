import { handler } from "@/server/http";
import { listModels } from "@/server/ai";

export const GET = handler(async () => ({ models: await listModels() }));
