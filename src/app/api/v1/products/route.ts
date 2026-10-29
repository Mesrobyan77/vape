import { handler } from "@/server/http/handler";
import { listProducts, productQuerySchema, toProductQuery } from "@/server/services/catalog";
import { parseLocale } from "@/server/i18n";

export const dynamic = "force-dynamic";

export const GET = handler({ query: productQuerySchema, cache: "public" }, async (ctx) => {
  const { items, meta } = await listProducts(toProductQuery(ctx.query), parseLocale(ctx.query.locale));
  return { data: items, meta };
});
