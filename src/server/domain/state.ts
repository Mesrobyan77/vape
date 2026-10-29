import type { OrderStatus, PaymentStatus } from "@/lib/api/types";

/** Central order state machine. Every status change goes through `canTransitionOrder`. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["processing", "cancelled"],
  awaiting_payment: ["paid", "payment_failed", "cancelled", "expired"],
  payment_failed: ["awaiting_payment", "paid", "cancelled", "expired"],
  paid: ["processing", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  cancelled: [],
  expired: [],
  refunded: [],
};

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  created: ["pending", "requires_action", "succeeded", "failed", "cancelled", "expired"],
  pending: ["requires_action", "succeeded", "failed", "cancelled", "expired"],
  requires_action: ["pending", "succeeded", "failed", "cancelled", "expired"],
  failed: ["pending", "succeeded", "cancelled", "expired"],
  succeeded: ["refunded"],
  cancelled: [],
  expired: ["succeeded"], // only via the late-payment reconciliation path
  refunded: [],
};

export const canTransitionOrder = (from: OrderStatus, to: OrderStatus): boolean => ORDER_TRANSITIONS[from].includes(to);
export const canTransitionPayment = (from: PaymentStatus, to: PaymentStatus): boolean => PAYMENT_TRANSITIONS[from].includes(to);

/** Statuses an order may be in to move to `to` (used as conditional-update filters). */
export const orderSourcesFor = (to: OrderStatus): OrderStatus[] =>
  (Object.keys(ORDER_TRANSITIONS) as OrderStatus[]).filter((from) => ORDER_TRANSITIONS[from].includes(to));

export const paymentSourcesFor = (to: PaymentStatus): PaymentStatus[] =>
  (Object.keys(PAYMENT_TRANSITIONS) as PaymentStatus[]).filter((from) => PAYMENT_TRANSITIONS[from].includes(to));

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ["cancelled", "expired", "refunded"];

/** Statuses a customer may cancel from (admin uses the full machine). */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ["pending", "awaiting_payment", "payment_failed"];

/** Admin transitions that need an explicit confirmation flag. */
export const SENSITIVE_TRANSITIONS: OrderStatus[] = ["cancelled", "refunded"];
