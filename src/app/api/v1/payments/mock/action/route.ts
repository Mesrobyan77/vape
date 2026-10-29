import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { connectDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { Order, PaymentTransaction } from "@/server/models";
import { mockAllowed } from "@/server/payments/mock";
import { applyMockCallback } from "@/server/payments/mock-flow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Button target of the simulated provider page. Plays the role of the provider's
 * server-to-server notification (dev/test only), then sends the customer back to the
 * storefront status page — which reads the real server-side state.
 */
export const POST = handler({ csrf: false, rawBody: true, rateLimit: [{ rule: LIMITS.callbacks }] }, async (ctx) => {
  if (!mockAllowed()) return new NextResponse("Not found", { status: 404 });
  const origin = ctx.req.headers.get("origin");
  if (origin && !config().allowedOrigins.includes(origin)) throw new AppError("ORIGIN_NOT_ALLOWED");
  const form = new URLSearchParams((await ctx.req.text()).slice(0, 2000));
  const paymentId = form.get("paymentId") ?? "";
  const outcome = form.get("outcome");
  if (!/^[a-f0-9]{24}$/i.test(paymentId) || (outcome !== "succeeded" && outcome !== "failed" && outcome !== "pending")) {
    return new NextResponse("Bad request", { status: 400 });
  }
  await connectDb();
  const payment = await PaymentTransaction.findOne({ _id: paymentId, provider: "mock" }).lean();
  const order = payment ? await Order.findById(payment.orderId).lean() : null;
  if (!payment || !order) return new NextResponse("Not found", { status: 404 });
  await applyMockCallback({ eventId: randomUUID(), orderNumber: order.number, amount: payment.amount, currency: "AMD", outcome });
  return NextResponse.redirect(`${config().siteUrl}/${order.locale}/checkout/success?order=${encodeURIComponent(order.number)}`, 303);
});
