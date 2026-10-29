import { AppError } from "@/server/errors";
import { localeOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { getProduct } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export const GET = handler<{ slug: string }>({ cache: "public" }, async (ctx) => {
  const product = await getProduct(String(ctx.params.slug), localeOf(ctx));
  if (!product) throw new AppError("NOT_FOUND");
  return { data: product };
});
