import { z } from "zod";
import { cartOwnerOf, localeOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { buildCartView, clearCart, findCart } from "@/server/services/cart";

export const dynamic = "force-dynamic";

const query = z
  .object({
    locale: z.enum(["hy", "ru", "en"]).optional(),
    region: z.string().trim().max(40).optional(),
    coupon: z.string().trim().max(40).optional(),
  })
  .passthrough();

export const GET = handler({ query }, async (ctx) => {
  const owner = cartOwnerOf(ctx);
  const cart = owner ? await findCart(owner) : null;
  return { data: await buildCartView(cart, localeOf(ctx), { region: ctx.query.region, coupon: ctx.query.coupon }) };
});

export const DELETE = handler({ rateLimit: [{ rule: LIMITS.cartWrite }] }, async (ctx) => {
  const owner = cartOwnerOf(ctx);
  const cart = owner ? await clearCart(owner) : null;
  return { data: await buildCartView(cart, localeOf(ctx)) };
});
