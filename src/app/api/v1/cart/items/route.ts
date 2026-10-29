import { z } from "zod";
import { ensureCartOwner, localeOf } from "@/server/http/common";
import { handler, objectId } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { addItem, buildCartView, MAX_LINE_QTY } from "@/server/services/cart";

export const dynamic = "force-dynamic";

const body = z.object({ productId: objectId, variantId: objectId, quantity: z.number().int().min(1).max(MAX_LINE_QTY) }).strict();

/** Client sends identifiers and quantity only — prices are always taken from the catalog. */
export const POST = handler({ body, requireAge: true, rateLimit: [{ rule: LIMITS.cartWrite }] }, async (ctx) => {
  const owner = await ensureCartOwner(ctx);
  const cart = await addItem(owner, ctx.body);
  return { status: 201, data: await buildCartView(cart, localeOf(ctx)) };
});
