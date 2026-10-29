import { z } from "zod";
import type { PaymentMethod, PaymentStatusResponse } from "@/lib/api/types";
import { AppError } from "../errors";
import { viewerOf } from "../http/common";
import { handler } from "../http/handler";
import { LIMITS } from "../http/rate-limit";
import { Order, PaymentTransaction } from "../models";
import { findOrderForViewer, initiatePayment, type OrderDocument } from "../services/orders";
import { providerFor } from "./registry";

export async function paymentStatusOf(order: OrderDocument): Promise<PaymentStatusResponse> {
  const payment = await PaymentTransaction.findOne({ orderId: order._id }).sort({ attempt: -1 }).lean();
  const awaiting = order.status === "awaiting_payment" || order.status === "payment_failed";
  return {
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
    method: order.paymentMethod,
    amount: order.totals.total,
    reservationExpiresAt: awaiting && order.reservationExpiresAt ? order.reservationExpiresAt.toISOString() : null,
    redirect: awaiting && providerFor(order.paymentMethod).online ? ((payment?.redirect as PaymentStatusResponse["redirect"]) ?? null) : null,
  };
}

const initiateBody = z.object({ orderNumber: z.string().trim().max(40) }).strict();

/** (Re)starts an online payment for the caller's own unpaid order. */
export function initiateRoute(method: PaymentMethod) {
  return handler({ body: initiateBody, rateLimit: [{ rule: LIMITS.paymentInitiate }] }, async (ctx) => {
    const provider = providerFor(method);
    if (!provider.isEnabled()) throw new AppError("PAYMENT_PROVIDER_UNAVAILABLE");
    const order = await findOrderForViewer(ctx.body.orderNumber, viewerOf(ctx));
    if (order.paymentMethod !== method) throw new AppError("VALIDATION_FAILED", undefined, [{ path: "orderNumber", message: "payment method mismatch" }]);
    if (order.status !== "awaiting_payment" && order.status !== "payment_failed") throw new AppError("INVALID_TRANSITION");
    if (order.reservationExpiresAt && order.reservationExpiresAt <= new Date()) throw new AppError("INVALID_TRANSITION", "The reservation has expired.");
    await initiatePayment(order);
    const fresh = (await Order.findById(order._id))!;
    return { data: await paymentStatusOf(fresh) };
  });
}
