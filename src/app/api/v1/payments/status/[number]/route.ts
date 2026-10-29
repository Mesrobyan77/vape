import { viewerOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { paymentStatusOf } from "@/server/payments/routes";
import { findOrderForViewer } from "@/server/services/orders";

export const dynamic = "force-dynamic";

/** Server-side status for the owning user / guest session only. Never cached. */
export const GET = handler<{ number: string }>({ rateLimit: [{ rule: LIMITS.paymentStatus }] }, async (ctx) => {
  const order = await findOrderForViewer(String(ctx.params.number), viewerOf(ctx));
  return { data: await paymentStatusOf(order) };
});
