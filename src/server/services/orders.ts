import { randomInt } from "node:crypto";
import { Types, type ClientSession, type HydratedDocument } from "mongoose";
import type {
  CheckoutRequest,
  CheckoutResponse,
  Locale,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/api/types";
import { computeTotals, evaluateCoupon, isRegionCode } from "@/lib/pricing";
import { config } from "../config";
import { stableHash } from "../crypto";
import { connectDb, withTransaction } from "../db";
import { CUSTOMER_CANCELLABLE, canTransitionOrder, orderSourcesFor } from "../domain/state";
import { AppError, isDuplicateKeyError } from "../errors";
import { tr } from "../i18n";
import { logger } from "../logger";
import {
  Cart,
  Coupon,
  InventoryMovement,
  Order,
  PaymentTransaction,
  Product,
  Reservation,
  User,
  effectivePrice,
  type CartDoc,
  type CouponDoc,
  type OrderDoc,
  type ProductDoc,
  type VariantDoc,
} from "../models";
import { providerFor } from "../payments/registry";
import { queueEmail } from "../email/send";
import { audit } from "./audit";
import { variantLabel } from "./catalog";
import { imageDto } from "./dto";
import { decrementStock, releaseOrderReservations } from "./inventory";
import { enqueue } from "./outbox";
import { getSettings, pricingSettingsOf } from "./settings";

type LeanProduct = Omit<ProductDoc, "variants"> & { variants: VariantDoc[] };
export type OrderDocument = HydratedDocument<OrderDoc>;

export interface Viewer {
  userId: Types.ObjectId | null;
  sessionHash: string | null;
}

const ORDER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateOrderNumber(now = new Date()): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  let suffix = "";
  for (let i = 0; i < 6; i += 1) suffix += ORDER_ALPHABET[randomInt(ORDER_ALPHABET.length)];
  return `VH-${yy}${mm}${dd}-${suffix}`;
}

export const ORDER_NUMBER_RE = /^VH-\d{6}-[A-Z0-9]{6}$/;

/* --------------------------------------------------------------- DTOs */

export function orderSummary(o: OrderDoc): OrderSummary {
  return {
    number: o.number,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    createdAt: o.createdAt.toISOString(),
    total: o.totals.total,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    reservationExpiresAt:
      o.reservationExpiresAt && (o.status === "awaiting_payment" || o.status === "payment_failed") ? o.reservationExpiresAt.toISOString() : null,
  };
}

export function orderDetail(o: OrderDoc, locale: Locale): OrderDetail {
  return {
    ...orderSummary(o),
    items: o.items.map((i) => ({
      name: tr(i.name, locale),
      sku: i.sku,
      variantLabel: tr(i.variantLabel, locale),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      image: imageDto(i.image, locale, tr(i.name, locale)),
    })),
    totals: { ...o.totals },
    customer: { ...o.customer },
    shipping: { region: o.shipping.region, city: o.shipping.city, line1: o.shipping.line1, line2: o.shipping.line2 ?? "", notes: o.shipping.notes ?? "" },
    timeline: o.timeline.map((t) => ({ status: t.status, at: new Date(t.at).toISOString(), ...(t.note ? { note: t.note } : {}) })),
    canCancel: CUSTOMER_CANCELLABLE.includes(o.status),
  };
}

/* --------------------------------------------------------- visibility */

export function canView(o: Pick<OrderDoc, "userId" | "sessionHash">, viewer: Viewer): boolean {
  if (o.userId) return viewer.userId !== null && o.userId.equals(viewer.userId);
  return viewer.sessionHash !== null && o.sessionHash === viewer.sessionHash;
}

/** Loads an order visible to the viewer; otherwise 404 (no existence leak). */
export async function findOrderForViewer(number: string, viewer: Viewer): Promise<OrderDocument> {
  if (!ORDER_NUMBER_RE.test(number)) throw new AppError("NOT_FOUND");
  await connectDb();
  const order = await Order.findOne({ number });
  if (!order || !canView(order, viewer)) throw new AppError("NOT_FOUND");
  return order;
}

export async function listUserOrders(userId: Types.ObjectId, page: number, pageSize: number) {
  await connectDb();
  const [docs, total] = await Promise.all([
    Order.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Order.countDocuments({ userId }),
  ]);
  return { items: docs.map(orderSummary), total };
}

/* ------------------------------------------------------------ checkout */

export interface CheckoutContext {
  viewer: Viewer;
  idempotencyKey: string;
  ageConfirmedAt: Date | null;
}

interface CheckoutOutcome {
  response: CheckoutResponse;
  replayed: boolean;
}

function scopeOf(viewer: Viewer): string {
  if (viewer.userId) return `u:${String(viewer.userId)}`;
  if (viewer.sessionHash) return `s:${viewer.sessionHash}`;
  throw new AppError("UNAUTHENTICATED");
}

async function responseFor(order: OrderDocument): Promise<CheckoutResponse> {
  const payment = await PaymentTransaction.findOne({ orderId: order._id }).sort({ attempt: -1 });
  let redirect: CheckoutResponse["payment"]["redirect"] = null;
  if (payment && providerFor(order.paymentMethod).online && (order.status === "awaiting_payment" || order.status === "payment_failed")) {
    redirect = (payment.redirect as CheckoutResponse["payment"]["redirect"]) ?? null;
  }
  return {
    order: orderSummary(order),
    payment: { method: order.paymentMethod, status: order.paymentStatus, redirect },
  };
}

async function replayOrConflict(scope: string, key: string, requestHash: string): Promise<CheckoutOutcome | null> {
  const existing = await Order.findOne({ idempotencyScope: scope, idempotencyKey: key });
  if (!existing) return null;
  if (existing.requestHash !== requestHash) throw new AppError("IDEMPOTENCY_KEY_REUSED");
  return { response: await responseFor(existing), replayed: true };
}

/** Normalizes the checkout body so equivalent payloads hash identically. */
export function checkoutRequestHash(input: CheckoutRequest): string {
  return stableHash({
    customer: { ...input.customer, email: input.customer.email.trim().toLowerCase() },
    shipping: { ...input.shipping, line2: input.shipping.line2 ?? "", notes: input.shipping.notes ?? "" },
    paymentMethod: input.paymentMethod,
    couponCode: input.couponCode?.trim().toUpperCase() ?? null,
    locale: input.locale,
  });
}

export async function checkout(input: CheckoutRequest, ctx: CheckoutContext): Promise<CheckoutOutcome> {
  await connectDb();
  const scope = scopeOf(ctx.viewer);
  const requestHash = checkoutRequestHash(input);

  const replay = await replayOrConflict(scope, ctx.idempotencyKey, requestHash);
  if (replay) return replay;

  if (!ctx.ageConfirmedAt || input.ageConfirmed !== true) throw new AppError("AGE_CONFIRMATION_REQUIRED");
  if (!isRegionCode(input.shipping.region)) {
    throw new AppError("VALIDATION_FAILED", undefined, [{ path: "shipping.region", message: "Unknown region" }]);
  }

  const provider = providerFor(input.paymentMethod);
  if (!provider.isEnabled()) throw new AppError("PAYMENT_PROVIDER_UNAVAILABLE");

  const owner = ctx.viewer.userId ? { userId: ctx.viewer.userId } : { sessionHash: ctx.viewer.sessionHash };
  const cart = await Cart.findOne(owner).lean<CartDoc>();
  if (!cart || cart.items.length === 0) {
    const late = await replayOrConflict(scope, ctx.idempotencyKey, requestHash);
    if (late) return late;
    throw new AppError("CART_EMPTY");
  }

  const settings = await getSettings();
  const pricing = pricingSettingsOf(settings);
  const online = provider.online;
  const ttlMs = settings.reservationTtlMinutes * 60_000;

  let order: OrderDocument | null = null;
  for (let attempt = 0; attempt < 3 && !order; attempt += 1) {
    try {
      order = await withTransaction((session) =>
        createOrderTx(session, { input, cart, scope, requestHash, key: ctx.idempotencyKey, viewer: ctx.viewer, pricing, online, ttlMs, ageConfirmedAt: ctx.ageConfirmedAt! }),
      );
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        const pattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};
        if ("idempotencyKey" in pattern || "idempotencyScope" in pattern) {
          const again = await replayOrConflict(scope, ctx.idempotencyKey, requestHash);
          if (again) return again;
        }
        if ("number" in pattern) continue; // order-number collision → retry with a new number
      }
      throw err;
    }
  }
  if (!order) throw new AppError("INTERNAL");

  // External provider call happens after commit — never inside a retried transaction.
  if (online) await initiatePayment(order);
  const fresh = (await Order.findById(order._id)) ?? order;
  return { response: await responseFor(fresh), replayed: false };
}

interface TxInput {
  input: CheckoutRequest;
  cart: CartDoc;
  scope: string;
  requestHash: string;
  key: string;
  viewer: Viewer;
  pricing: ReturnType<typeof pricingSettingsOf>;
  online: boolean;
  ttlMs: number;
  ageConfirmedAt: Date;
}

async function createOrderTx(session: ClientSession, t: TxInput): Promise<OrderDocument> {
  const now = new Date();
  const conflicts: { itemId: string; sku: string; requested: number; available: number }[] = [];
  const productIds = t.cart.items.map((i) => i.productId);
  const products = new Map(
    (await Product.find({ _id: { $in: productIds } }).session(session).lean<LeanProduct[]>()).map((p) => [String(p._id), p]),
  );

  const lines = t.cart.items.map((item) => {
    const product = products.get(String(item.productId));
    const variant = product?.variants.find((v) => String(v._id) === String(item.variantId));
    if (!product || product.status !== "active" || !variant || !variant.active) {
      conflicts.push({ itemId: String(item._id), sku: variant?.sku ?? "", requested: item.quantity, available: 0 });
      return null;
    }
    return { item, product, variant, unitPrice: effectivePrice(variant) };
  });
  if (conflicts.length) throw new AppError("OUT_OF_STOCK", undefined, conflicts);
  const valid = lines.filter((l): l is NonNullable<typeof l> => l !== null);

  // Reserve every line atomically; any failure aborts the whole transaction (all-or-nothing).
  for (const line of valid) {
    const ok = await decrementStock(session, line.product._id, line.variant._id, line.item.quantity);
    if (!ok) {
      const latest = await Product.findOne({ _id: line.product._id, "variants._id": line.variant._id }, { "variants.$": 1 })
        .session(session)
        .lean<{ variants: VariantDoc[] }>();
      conflicts.push({
        itemId: String(line.item._id),
        sku: line.variant.sku,
        requested: line.item.quantity,
        available: Math.max(0, latest?.variants[0]?.stock ?? 0),
      });
    }
  }
  if (conflicts.length) throw new AppError("OUT_OF_STOCK", undefined, conflicts);

  const subtotal = valid.reduce((s, l) => s + l.unitPrice * l.item.quantity, 0);
  let discount = 0;
  let couponSnapshot: OrderDoc["coupon"] = null;
  if (t.input.couponCode) {
    const code = t.input.couponCode.trim().toUpperCase();
    const coupon = await Coupon.findOne({ code }).session(session).lean<CouponDoc>();
    const result = evaluateCoupon(coupon, subtotal, now);
    if (!result.ok || !coupon) {
      throw new AppError("VALIDATION_FAILED", undefined, [{ path: "couponCode", message: result.ok ? "not_found" : result.reason }]);
    }
    const used = await Coupon.updateOne(
      { _id: coupon._id, active: true, $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
      { $inc: { usedCount: 1 } },
      { session },
    );
    if (used.modifiedCount !== 1) throw new AppError("VALIDATION_FAILED", undefined, [{ path: "couponCode", message: "usage_limit" }]);
    discount = result.discount;
    couponSnapshot = { code: coupon.code, type: coupon.type, value: coupon.value };
  }

  const region = t.input.shipping.region as Parameters<typeof computeTotals>[1];
  const totals = computeTotals(
    valid.map((l) => ({ unitPrice: l.unitPrice, quantity: l.item.quantity })),
    region,
    t.pricing,
    discount,
  );

  const status: OrderStatus = t.online ? "awaiting_payment" : "pending";
  const paymentStatus: PaymentStatus = t.online ? "created" : "pending";
  const reservationExpiresAt = t.online ? new Date(now.getTime() + t.ttlMs) : null;

  const [created] = await Order.create(
    [
      {
        number: generateOrderNumber(now),
        userId: t.viewer.userId,
        sessionHash: t.viewer.sessionHash,
        idempotencyScope: t.scope,
        idempotencyKey: t.key,
        requestHash: t.requestHash,
        status,
        paymentStatus,
        paymentMethod: t.input.paymentMethod,
        locale: t.input.locale,
        currency: "AMD",
        items: valid.map((l) => ({
          productId: l.product._id,
          variantId: l.variant._id,
          slug: l.product.slug,
          name: l.product.name,
          variantLabel: {
            hy: variantLabel(l.variant, "hy"),
            ru: variantLabel(l.variant, "ru"),
            en: variantLabel(l.variant, "en"),
          },
          sku: l.variant.sku,
          attributes: { ...(l.variant.attributes ?? {}) },
          image: l.variant.images[0] ?? l.product.images[0] ?? null,
          quantity: l.item.quantity,
          unitPrice: l.unitPrice,
          regularUnitPrice: l.variant.price,
          lineTotal: l.unitPrice * l.item.quantity,
        })),
        totals: {
          subtotal: totals.subtotal,
          discount: totals.discount,
          shipping: totals.shipping,
          vatRatePercent: totals.vatRatePercent,
          vatAmount: totals.vatAmount,
          total: totals.total,
        },
        coupon: couponSnapshot,
        pricing: {
          freeShippingThreshold: totals.freeShippingThreshold,
          shippingRule: "free when (subtotal - discount) >= threshold; yerevan vs other-region fee",
          vatRounding: "round_half_up(total * rate / (100 + rate))",
          computedAt: now,
        },
        customer: {
          firstName: t.input.customer.firstName,
          lastName: t.input.customer.lastName,
          email: t.input.customer.email.trim().toLowerCase(),
          phone: t.input.customer.phone,
        },
        shipping: {
          region: t.input.shipping.region,
          city: t.input.shipping.city,
          line1: t.input.shipping.line1,
          line2: t.input.shipping.line2 ?? "",
          notes: t.input.shipping.notes ?? "",
        },
        ageConfirmed: true,
        termsAcceptedAt: now,
        reservationExpiresAt,
        timeline: [{ status, at: now }],
      },
    ],
    { session },
  );
  const order = created!;

  await Reservation.insertMany(
    valid.map((l) => ({
      orderId: order._id,
      productId: l.product._id,
      variantId: l.variant._id,
      sku: l.variant.sku,
      quantity: l.item.quantity,
      status: t.online ? "active" : "consumed",
      expiresAt: reservationExpiresAt ?? now,
      consumedAt: t.online ? null : now,
      idempotencyKey: t.key,
    })),
    { session },
  );
  await InventoryMovement.insertMany(
    valid.map((l) => ({
      productId: l.product._id,
      variantId: l.variant._id,
      sku: l.variant.sku,
      delta: -l.item.quantity,
      stockBefore: l.variant.stock,
      stockAfter: l.variant.stock - l.item.quantity,
      reason: `order ${order.number}`,
      kind: "order",
      actorId: null,
    })),
    { session },
  );
  await PaymentTransaction.create(
    [
      {
        orderId: order._id,
        orderNumber: order.number,
        provider: t.input.paymentMethod,
        status: paymentStatus,
        amount: totals.total,
        currency: "AMD",
        attempt: 1,
        history: [{ status: paymentStatus, at: now }],
      },
    ],
    { session },
  );
  await Cart.updateOne({ _id: t.cart._id }, { $set: { items: [] } }, { session });

  const emailData = {
    name: t.input.customer.firstName,
    orderNumber: order.number,
    total: totals.total,
    items: order.items.map((i) => ({ name: tr(i.name, t.input.locale), quantity: i.quantity, lineTotal: i.lineTotal })),
    orderUrl: `${config().siteUrl}/${t.input.locale}/checkout/success?order=${order.number}`,
    paymentMethod: t.input.paymentMethod,
  };
  await queueEmail(
    { to: order.customer.email, template: t.online ? "payment_pending" : "order_confirmation", locale: t.input.locale, data: emailData },
    `order-created:${order.number}`,
    session,
  );
  const adminEmail = config().adminNotifyEmail;
  if (adminEmail) {
    await queueEmail({ to: adminEmail, template: "admin_new_order", locale: "en", data: emailData }, `admin-new-order:${order.number}`, session);
  }
  await enqueue([{ type: "revalidate", dedupeKey: `revalidate:order:${order.number}`, payload: { tags: ["catalog"] } }], session);
  return order;
}

/* ----------------------------------------------------------- payments */

export async function initiatePayment(order: OrderDocument): Promise<void> {
  const provider = providerFor(order.paymentMethod);
  const payment = await PaymentTransaction.findOne({ orderId: order._id }).sort({ attempt: -1 });
  if (!payment || !provider.online) return;
  if (!["created", "pending", "failed", "requires_action"].includes(payment.status)) return;
  try {
    const result = await provider.initiate({
      paymentId: String(payment._id),
      orderNumber: order.number,
      amount: payment.amount,
      locale: order.locale,
      description: `Vape Hub ${order.number}`,
      customerEmail: order.customer.email,
    });
    await PaymentTransaction.updateOne(
      { _id: payment._id, status: payment.status },
      {
        $set: { status: "requires_action", redirect: result.redirect, ...(result.providerRef ? { providerRef: result.providerRef } : {}) },
        $push: { history: { status: "requires_action", at: new Date() } },
      },
    );
    await Order.updateOne({ _id: order._id, paymentStatus: { $in: ["created", "pending", "failed"] } }, { $set: { paymentStatus: "requires_action" } });
  } catch (err) {
    // Provider unreachable: the order keeps its reservation until expiry; the customer can retry.
    logger.warn({ order: order.number, provider: order.paymentMethod, err }, "payment initiation failed");
  }
}

/* --------------------------------------------------------- cancellation */

export interface Actor {
  id: Types.ObjectId | null;
  email: string | null;
  kind: "customer" | "admin" | "system";
  requestId?: string;
  ip?: string;
}

const PAYMENT_CANCELLABLE: PaymentStatus[] = ["created", "pending", "requires_action", "failed"];

export async function cancelOrder(orderId: Types.ObjectId, actor: Actor, note?: string, allowedFrom?: OrderStatus[]): Promise<OrderDocument> {
  const sources = (allowedFrom ?? orderSourcesFor("cancelled")).filter((s) => canTransitionOrder(s, "cancelled"));
  const updated = await withTransaction(async (session) => {
    const now = new Date();
    const current = await Order.findById(orderId).session(session);
    if (!current) throw new AppError("NOT_FOUND");
    if (current.paymentStatus === "succeeded") {
      throw new AppError("INVALID_TRANSITION", "Paid orders must be refunded instead of cancelled.");
    }
    const res = await Order.updateOne(
      { _id: orderId, status: { $in: sources }, paymentStatus: { $ne: "succeeded" } },
      { $set: { status: "cancelled", reservationExpiresAt: null }, $push: { timeline: { status: "cancelled", at: now, note, actor: actor.kind } } },
      { session },
    );
    if (res.modifiedCount !== 1) throw new AppError("INVALID_TRANSITION");
    await releaseOrderReservations(session, orderId, "released");
    await PaymentTransaction.updateMany(
      { orderId, status: { $in: PAYMENT_CANCELLABLE } },
      { $set: { status: "cancelled" }, $push: { history: { status: "cancelled", at: now } } },
      { session },
    );
    await Order.updateOne({ _id: orderId, paymentStatus: { $in: PAYMENT_CANCELLABLE } }, { $set: { paymentStatus: "cancelled" } }, { session });
    const order = (await Order.findById(orderId).session(session))!;
    await queueEmail(
      { to: order.customer.email, template: "order_cancelled", locale: order.locale, data: { name: order.customer.firstName, orderNumber: order.number } },
      `order-cancelled:${order.number}`,
      session,
    );
    if (actor.kind === "admin") {
      await audit(
        { actorId: actor.id, actorEmail: actor.email, action: "order.transition", targetType: "order", targetId: order.number, changes: { to: "cancelled", note }, requestId: actor.requestId, ip: actor.ip },
        session,
      );
    }
    return order;
  });
  return updated;
}

export async function refundOrder(orderId: Types.ObjectId, actor: Actor, note?: string): Promise<OrderDocument> {
  return withTransaction(async (session) => {
    const now = new Date();
    const current = await Order.findById(orderId).session(session);
    if (!current) throw new AppError("NOT_FOUND");
    if (!canTransitionOrder(current.status, "refunded")) throw new AppError("INVALID_TRANSITION");
    // Refund exactly once: the payment must move succeeded → refunded conditionally.
    const pay = await PaymentTransaction.updateOne(
      { orderId, status: "succeeded" },
      { $set: { status: "refunded" }, $push: { history: { status: "refunded", at: now, reason: note } } },
      { session },
    );
    if (pay.modifiedCount !== 1) throw new AppError("INVALID_TRANSITION", "No captured payment to refund (already refunded or unpaid).");
    const res = await Order.updateOne(
      { _id: orderId, status: current.status, paymentStatus: "succeeded" },
      {
        $set: { status: "refunded", paymentStatus: "refunded", refundedAt: now },
        $push: { timeline: { status: "refunded", at: now, note, actor: actor.kind } },
      },
      { session },
    );
    if (res.modifiedCount !== 1) throw new AppError("INVALID_TRANSITION");
    if (current.status === "paid" || current.status === "processing") {
      // Goods never left the store → return them to stock (once).
      await releaseOrderReservations(session, orderId, "released", ["consumed", "active"]);
    }
    const order = (await Order.findById(orderId).session(session))!;
    await queueEmail(
      { to: order.customer.email, template: "order_refunded", locale: order.locale, data: { name: order.customer.firstName, orderNumber: order.number } },
      `order-refunded:${order.number}`,
      session,
    );
    await audit(
      { actorId: actor.id, actorEmail: actor.email, action: "order.refund", targetType: "order", targetId: order.number, changes: { from: current.status, note }, requestId: actor.requestId, ip: actor.ip },
      session,
    );
    return order;
  });
}

/** Admin transition through the central state machine. */
export async function adminTransition(orderId: Types.ObjectId, to: OrderStatus, actor: Actor, opts: { note?: string; confirm?: boolean }): Promise<OrderDocument> {
  await connectDb();
  if ((to === "cancelled" || to === "refunded") && opts.confirm !== true) {
    throw new AppError("VALIDATION_FAILED", "Confirmation is required for this action.", [{ path: "confirm", message: "required" }]);
  }
  if (to === "cancelled") return cancelOrder(orderId, actor, opts.note);
  if (to === "refunded") return refundOrder(orderId, actor, opts.note);
  // Payment state is only changed by verified provider events — never by a manual label.
  if (to === "paid" || to === "payment_failed" || to === "awaiting_payment" || to === "expired") {
    throw new AppError("INVALID_TRANSITION", "Payment states are set by verified payment events only.");
  }
  return withTransaction(async (session) => {
    const now = new Date();
    const current = await Order.findById(orderId).session(session);
    if (!current) throw new AppError("NOT_FOUND");
    if (!canTransitionOrder(current.status, to)) throw new AppError("INVALID_TRANSITION");
    if (current.reconciliation?.required) throw new AppError("INVALID_TRANSITION", "Order requires payment reconciliation first.");
    const set: Record<string, unknown> = { status: to };
    // Cash on delivery is collected when the courier hands over the goods.
    if (to === "delivered" && current.paymentMethod === "cod" && current.paymentStatus === "pending") {
      set.paymentStatus = "succeeded";
      await PaymentTransaction.updateOne(
        { orderId, status: "pending" },
        { $set: { status: "succeeded" }, $push: { history: { status: "succeeded", at: now, reason: "cash collected" } } },
        { session },
      );
    }
    const res = await Order.updateOne(
      { _id: orderId, status: current.status },
      { $set: set, $push: { timeline: { status: to, at: now, note: opts.note, actor: "admin" } } },
      { session },
    );
    if (res.modifiedCount !== 1) throw new AppError("INVALID_TRANSITION");
    const order = (await Order.findById(orderId).session(session))!;
    await queueEmail(
      {
        to: order.customer.email,
        template: to === "shipped" ? "order_shipped" : "order_status",
        locale: order.locale,
        data: { name: order.customer.firstName, orderNumber: order.number, status: to },
      },
      `order-status:${order.number}:${to}`,
      session,
    );
    await audit(
      { actorId: actor.id, actorEmail: actor.email, action: "order.transition", targetType: "order", targetId: order.number, changes: { from: current.status, to, note: opts.note }, requestId: actor.requestId, ip: actor.ip },
      session,
    );
    return order;
  });
}

/* ------------------------------------------------------------- expiry */

const EXPIRABLE: OrderStatus[] = ["awaiting_payment", "payment_failed"];

/**
 * Expires unpaid orders whose reservation window passed. Each order is claimed with a
 * conditional status update inside a transaction, so concurrent runners and repeated
 * runs restore stock at most once.
 */
export async function expireReservations(now = new Date(), limit = 100): Promise<number> {
  await connectDb();
  const due = await Order.find({ status: { $in: EXPIRABLE }, reservationExpiresAt: { $lte: now } }, { _id: 1 }).limit(limit).lean();
  let expired = 0;
  for (const { _id } of due) {
    try {
      const done = await withTransaction(async (session) => {
        const claim = await Order.updateOne(
          { _id, status: { $in: EXPIRABLE }, reservationExpiresAt: { $lte: now } },
          { $set: { status: "expired" }, $push: { timeline: { status: "expired", at: new Date(), actor: "system" } } },
          { session },
        );
        if (claim.modifiedCount !== 1) return false;
        await releaseOrderReservations(session, _id as Types.ObjectId, "expired", ["active"]);
        await PaymentTransaction.updateMany(
          { orderId: _id, status: { $in: PAYMENT_CANCELLABLE } },
          { $set: { status: "expired" }, $push: { history: { status: "expired", at: new Date() } } },
          { session },
        );
        await Order.updateOne({ _id, paymentStatus: { $in: PAYMENT_CANCELLABLE } }, { $set: { paymentStatus: "expired" } }, { session });
        const order = (await Order.findById(_id).session(session))!;
        await queueEmail(
          { to: order.customer.email, template: "order_status", locale: order.locale, data: { name: order.customer.firstName, orderNumber: order.number, status: "expired" } },
          `order-status:${order.number}:expired`,
          session,
        );
        return true;
      });
      if (done) expired += 1;
    } catch (err) {
      logger.warn({ err, orderId: String(_id) }, "reservation expiry failed; will retry next run");
    }
  }
  return expired;
}

export async function saveAddressFromCheckout(userId: Types.ObjectId, input: CheckoutRequest): Promise<void> {
  const user = await User.findById(userId);
  if (!user || user.addresses.length >= 10) return;
  const dup = user.addresses.some((a) => a.line1 === input.shipping.line1 && a.city === input.shipping.city && a.region === input.shipping.region);
  if (dup) return;
  user.addresses.push({
    label: "",
    fullName: `${input.customer.firstName} ${input.customer.lastName}`.trim(),
    phone: input.customer.phone,
    region: input.shipping.region,
    city: input.shipping.city,
    line1: input.shipping.line1,
    line2: input.shipping.line2 ?? "",
    notes: input.shipping.notes ?? "",
    isDefault: user.addresses.length === 0,
  });
  await user.save();
}

export type { PaymentMethod };
