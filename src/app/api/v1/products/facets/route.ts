import { handler } from "@/server/http/handler";
import { getFacets, productQuerySchema, toProductQuery } from "@/server/services/catalog";
import { parseLocale } from "@/server/i18n";

export const dynamic = "force-dynamic";

export const GET = handler({ query: productQuerySchema, cache: "public" }, async (ctx) => ({
  data: await getFacets(toProductQuery(ctx.query), parseLocale(ctx.query.locale)),
}));
