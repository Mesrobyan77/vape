import { z } from "zod";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { searchPexels } from "@/server/services/media";

export const dynamic = "force-dynamic";

const query = z
  .object({
    q: z.string().trim().min(2).max(80),
    page: z.coerce.number().int().min(1).max(20).default(1),
    orientation: z.enum(["landscape", "portrait", "square"]).optional(),
  })
  .strict();

/** Admin-only, validated and rate-limited. Never an open proxy; the API key never leaves the server. */
export const GET = handler({ auth: "admin", query, rateLimit: [{ rule: LIMITS.pexels }] }, async (ctx) => ({
  data: await searchPexels(ctx.query.q, ctx.query.page, ctx.query.orientation),
}));
