import type { Types } from "mongoose";
import type { PaymentMethod } from "@/lib/api/types";
import { config } from "../config";
import { connectDb, withTransaction } from "../db";
import { isDuplicateKeyError } from "../errors";
import { logger } from "../logger";
import { Order, PaymentEvent, PaymentTransaction, Reservation } from "../models";
import { queueEmail } from "../email/send";
import { audit } from "../services/audit";
import { decrementStock } from "../services/inventory";
import { consumeOrderReservations } from "../services/inventory";
import type { VerifiedPaymentEvent } from "./types";

export type ApplyOutcome =
  | { result: "applied"; orderNumber: string; orderStatus: string }
  | { result: "duplicate"; orderNumber: string }
  | { result: "rejected"; reason: string }
  | { result: "reconciliation"; orderNumber: string; reason: string };

/** Records a rejected/unverifiable callback for investigation (sanitized, no secrets). */
export async function recordRejectedCallback(method: PaymentMethod, reason: string, summary: Record<string, string | number | boolean | null>): Promise<void> {
  await connectDb();
  await audit({ action: "payment.callback_rejected", targetType: "payment", targetId: String(summary.orderNumber ?? ""), changes: { provider: method, reason, ...summary } });
  logger.warn({ provider: method, reason }, "payment callback rejected");
}

class Duplicate extends Error {}

/**
 * Applies a VERIFIED provider event (signature already checked by the caller).
 * - Matches merchant order, exact amount and currency against the local payment record.
 * - Idempotent: the (provider, eventKey) unique index makes duplicates no-ops, and every
 *   state change is a conditional update inside one transaction.
 * - Late success after reservation expiry tries to re-reserve stock; otherwise the order is
 *   flagged for manual reconciliation and is never fulfilled automatically.
 */
export async function applyVerifiedPayment(method: PaymentMethod, event: VerifiedPaymentEvent): Promise<ApplyOutcome> {
  await connectDb();
  const order = await Order.findOne({ number: event.orderNumber });
  if (!order || order.paymentMethod !== method) {
    await recordRejectedCallback(method, "unknown_order", { orderNumber: event.orderNumber, eventKey: event.eventKey });
    return { result: "rejected", reason: "unknown_order" };
  }
  const payment = await PaymentTransaction.findOne({ orderId: order._id, provider: method }).sort({ attempt: -1 });
  if (!payment) {
    await recordRejectedCallback(method, "unknown_payment", { orderNumber: event.orderNumber });
    return { result: "rejected", reason: "unknown_payment" };
  }
  if (event.currency !== "AMD" || event.amount !== payment.amount || payment.amount !== order.totals.total) {
    await recordRejectedCallback(method, "amount_mismatch", { orderNumber: event.orderNumber, received: event.amount, currency: event.currency });
    return { result: "rejected", reason: "amount_mismatch" };
  }
  if (event.providerRef && payment.providerRef && event.providerRef !== payment.providerRef) {
    await recordRejectedCallback(method, "reference_mismatch", { orderNumber: event.orderNumber });
    return { result: "rejected", reason: "reference_mismatch" };
  }

  try {
    return await withTransaction(async (session) => {
      const now = new Date();
      try {
        await PaymentEvent.create(
          [
            {
              provider: method,
              eventKey: event.eventKey,
              paymentId: payment._id,
              orderNumber: order.number,
              type: event.outcome,
              verified: true,
              outcome: "received",
              summary: event.summary,
            },
          ],
          { session },
        );
      } catch (err) {
        if (isDuplicateKeyError(err)) throw new Duplicate();
        throw err;
      }

      const current = (await Order.findById(order._id).session(session))!;
      const emailBase = { to: current.customer.email, locale: current.locale };
      const nameData = { name: current.customer.firstName, orderNumber: current.number, total: current.totals.total };

      if (event.outcome === "pending") {
        await PaymentTransaction.updateOne(
          { _id: payment._id, status: { $in: ["created", "requires_action"] } },
          { $set: { status: "pending" }, $push: { history: { status: "pending", at: now } } },
          { session },
        );
        await Order.updateOne({ _id: current._id, paymentStatus: { $in: ["created", "requires_action"] } }, { $set: { paymentStatus: "pending" } }, { session });
        return { result: "applied" as const, orderNumber: current.number, orderStatus: current.status };
      }

      if (event.outcome === "failed") {
        await PaymentTransaction.updateOne(
          { _id: payment._id, status: { $in: ["created", "pending", "requires_action"] } },
          { $set: { status: "failed" }, $push: { history: { status: "failed", at: now } } },
          { session },
        );
        const res = await Order.updateOne(
          { _id: current._id, status: "awaiting_payment" },
          { $set: { status: "payment_failed", paymentStatus: "failed" }, $push: { timeline: { status: "payment_failed", at: now, actor: "provider" } } },
          { session },
        );
        if (res.modifiedCount === 1) {
          await queueEmail({ ...emailBase, template: "payment_failed", data: nameData }, `payment-failed:${current.number}:${event.eventKey}`, session);
        }
        return { result: "applied" as const, orderNumber: current.number, orderStatus: res.modifiedCount === 1 ? "payment_failed" : current.status };
      }

      // outcome === "succeeded"
      if (current.paymentStatus === "succeeded" || current.paymentStatus === "refunded") {
        return { result: "duplicate" as const, orderNumber: current.number };
      }

      const markPaymentSucceeded = async () => {
        const r = await PaymentTransaction.updateOne(
          { _id: payment._id, status: { $in: ["created", "pending", "requires_action", "failed", "expired", "cancelled"] } },
          { $set: { status: "succeeded", ...(event.providerRef ? { providerRef: event.providerRef } : {}) }, $push: { history: { status: "succeeded", at: now } } },
          { session },
        );
        return r.modifiedCount === 1;
      };

      if (current.status === "awaiting_payment" || current.status === "payment_failed") {
        const lines = await Reservation.countDocuments({ orderId: current._id }).session(session);
        const consumed = await consumeOrderReservations(session, current._id);
        if (consumed !== lines) throw new Error("reservation state inconsistent with order status");
        const res = await Order.updateOne(
          { _id: current._id, status: { $in: ["awaiting_payment", "payment_failed"] } },
          {
            $set: { status: "paid", paymentStatus: "succeeded", reservationExpiresAt: null },
            $push: { timeline: { status: "paid", at: now, actor: "provider" } },
          },
          { session },
        );
        if (res.modifiedCount !== 1) throw new Error("order changed concurrently");
        await markPaymentSucceeded();
        await queueEmail({ ...emailBase, template: "payment_confirmed", data: nameData }, `payment-confirmed:${current.number}`, session);
        return { result: "applied" as const, orderNumber: current.number, orderStatus: "paid" };
      }

      if (current.status === "expired") {
        // Late payment: try to take the stock again atomically.
        const reserved: { productId: Types.ObjectId; variantId: Types.ObjectId; quantity: number }[] = [];
        let ok = true;
        for (const item of current.items) {
          if (await decrementStock(session, item.productId, item.variantId, item.quantity)) {
            reserved.push(item);
          } else {
            ok = false;
            break;
          }
        }
        if (ok) {
          await Reservation.updateMany({ orderId: current._id, status: "expired" }, { $set: { status: "consumed", consumedAt: now } }, { session });
          await Order.updateOne(
            { _id: current._id, status: "expired" },
            {
              $set: { status: "paid", paymentStatus: "succeeded" },
              $push: { timeline: { status: "paid", at: now, note: "late payment — stock re-reserved", actor: "provider" } },
            },
            { session },
          );
          await markPaymentSucceeded();
          await queueEmail({ ...emailBase, template: "payment_confirmed", data: nameData }, `payment-confirmed:${current.number}`, session);
          return { result: "applied" as const, orderNumber: current.number, orderStatus: "paid" };
        }
        // Not enough stock: abort partial decrements by throwing, then flag outside.
        throw new LateNoStock(current.number);
      }

      // cancelled / refunded / anything else: money arrived for an order we cannot fulfil.
      await markPaymentSucceeded();
      await Order.updateOne(
        { _id: current._id },
        { $set: { paymentStatus: "succeeded", reconciliation: { required: true, reason: `payment_after_${current.status}`, flaggedAt: now } } },
        { session },
      );
      await audit({ action: "payment.reconciliation_required", targetType: "order", targetId: current.number, changes: { reason: `payment_after_${current.status}` } }, session);
      return { result: "reconciliation" as const, orderNumber: current.number, reason: `payment_after_${current.status}` };
    });
  } catch (err) {
    if (err instanceof Duplicate) return { result: "duplicate", orderNumber: order.number };
    if (err instanceof LateNoStock) return flagLateNoStock(method, event, order._id, payment._id);
    throw err;
  }
}

class LateNoStock extends Error {
  constructor(readonly orderNumber: string) {
    super("late payment without stock");
  }
}

async function flagLateNoStock(method: PaymentMethod, event: VerifiedPaymentEvent, orderId: Types.ObjectId, paymentId: Types.ObjectId): Promise<ApplyOutcome> {
  const reason = "late_payment_stock_unavailable";
  return withTransaction(async (session) => {
    const now = new Date();
    try {
      await PaymentEvent.create(
        [{ provider: method, eventKey: event.eventKey, paymentId, orderNumber: event.orderNumber, type: "succeeded", verified: true, outcome: reason, summary: event.summary }],
        { session },
      );
    } catch (err) {
      if (isDuplicateKeyError(err)) return { result: "duplicate" as const, orderNumber: event.orderNumber };
      throw err;
    }
    await PaymentTransaction.updateOne(
      { _id: paymentId, status: { $ne: "succeeded" } },
      { $set: { status: "succeeded" }, $push: { history: { status: "succeeded", at: now, reason } } },
      { session },
    );
    await Order.updateOne({ _id: orderId }, { $set: { paymentStatus: "succeeded", reconciliation: { required: true, reason, flaggedAt: now } } }, { session });
    await audit({ action: "payment.reconciliation_required", targetType: "order", targetId: event.orderNumber, changes: { reason } }, session);
    return { result: "reconciliation" as const, orderNumber: event.orderNumber, reason };
  });
}

export const callbackSiteUrl = () => config().siteUrl;
