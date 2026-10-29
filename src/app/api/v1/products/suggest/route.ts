import { z } from "zod";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { suggestProducts } from "@/server/services/catalog";
import { parseLocale } from "@/server/i18n";

export const dynamic = "force-dynamic";

const query = z.object({ q: z.string().trim().min(2).max(64), locale: z.enum(["hy", "ru", "en"]).optional() }).passthrough();

export const GET = handler({ query, cache: "public", rateLimit: [{ rule: LIMITS.search }] }, async (ctx) => ({
  data: await suggestProducts(ctx.query.q, parseLocale(ctx.query.locale)),
}));
