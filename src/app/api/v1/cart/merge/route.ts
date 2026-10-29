import { handler } from "@/server/http/handler";
import { localeOf } from "@/server/http/common";
import { buildCartView, findCart } from "@/server/services/cart";

export const dynamic = "force-dynamic";

/**
 * Idempotent. Login already merges the pre-login guest cart; after rotation the old
 * guest session is gone, so this simply returns the authenticated cart.
 */
export const POST = handler({ auth: "user" }, async (ctx) => ({
  data: await buildCartView(await findCart({ userId: ctx.user!._id }), localeOf(ctx)),
}));
