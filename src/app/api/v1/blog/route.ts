import { z } from "zod";
import { handler } from "@/server/http/handler";
import { parseLocale } from "@/server/i18n";
import { listBlogPosts } from "@/server/services/content";

export const dynamic = "force-dynamic";

const query = z
  .object({
    locale: z.enum(["hy", "ru", "en"]).optional(),
    page: z.coerce.number().int().min(1).max(1000).optional(),
    pageSize: z.coerce.number().int().min(1).max(24).optional(),
    category: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
    q: z.string().trim().max(64).optional(),
  })
  .passthrough();

export const GET = handler({ query, cache: "public" }, async (ctx) => {
  const { items, meta } = await listBlogPosts(ctx.query, parseLocale(ctx.query.locale));
  return { data: items, meta };
});
