import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { connectDb } from "@/server/db";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { logger } from "@/server/logger";
import { Order, PaymentTransaction } from "@/server/models";
import { applyVerifiedPayment } from "@/server/payments/apply";
import { ARCA_CURRENCY, arcaOrderStatus } from "@/server/payments/arca";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Customer return URL from the ArCa page. The query string is NEVER trusted: the only input
 * used is the gateway orderId, and the outcome comes from a server-side status request.
 */
export const GET = handler({ csrf: false, rateLimit: [{ rule: LIMITS.callbacks }] }, async (ctx) => {
  const cfg = config();
  if (cfg.paymentMode !== "live" || !cfg.arca) return new NextResponse("Not found", { status: 404 });
  const orderId = ctx.req.nextUrl.searchParams.get("orderId") ?? "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(orderId)) return new NextResponse("Bad request", { status: 400 });
  await connectDb();
  const payment = await PaymentTransaction.findOne({ provider: "arca", providerRef: orderId });
  if (!payment) return new NextResponse("Not found", { status: 404 });
  const order = await Order.findById(payment.orderId);
  if (!order) return new NextResponse("Not found", { status: 404 });
  try {
    const status = await arcaOrderStatus(orderId);
    const amountOk = status.amount === payment.amount * 100 && status.currency === ARCA_CURRENCY;
    if (status.orderNumber === order.number && amountOk && status.orderStatus === 2) {
      await applyVerifiedPayment("arca", {
        eventKey: `arca:${orderId}:deposited`,
        orderNumber: order.number,
        providerRef: orderId,
        amount: payment.amount,
        currency: "AMD",
        outcome: "succeeded",
        summary: { orderNumber: order.number, orderStatus: 2 },
      });
    } else if (status.orderNumber === order.number && (status.orderStatus === 3 || status.orderStatus === 6)) {
      await applyVerifiedPayment("arca", {
        eventKey: `arca:${orderId}:declined:${status.orderStatus}`,
        orderNumber: order.number,
        providerRef: orderId,
        amount: payment.amount,
        currency: "AMD",
        outcome: "failed",
        summary: { orderNumber: order.number, orderStatus: status.orderStatus },
      });
    }
  } catch (err) {
    // Gateway unreachable: leave state untouched; the status page keeps polling honestly.
    logger.warn({ err, order: order.number }, "arca status check failed");
  }
  return NextResponse.redirect(`${cfg.siteUrl}/${order.locale}/checkout/success?order=${encodeURIComponent(order.number)}`, 303);
});
