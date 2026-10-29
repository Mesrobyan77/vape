import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/api/types";
import {
  CUSTOMER_CANCELLABLE,
  ORDER_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  SENSITIVE_TRANSITIONS,
  TERMINAL_ORDER_STATUSES,
  paymentSourcesFor,
  canTransitionOrder,
  canTransitionPayment,
  orderSourcesFor,
} from "@/server/domain/state";

describe("order state machine", () => {
  it("defines transitions for every status", () => {
    for (const s of ORDER_STATUSES) expect(ORDER_TRANSITIONS[s]).toBeDefined();
  });
  it("allows the happy paths", () => {
    expect(canTransitionOrder("awaiting_payment", "paid")).toBe(true);
    expect(canTransitionOrder("paid", "processing")).toBe(true);
    expect(canTransitionOrder("processing", "shipped")).toBe(true);
    expect(canTransitionOrder("shipped", "delivered")).toBe(true);
    expect(canTransitionOrder("pending", "processing")).toBe(true);
  });
  it("forbids dangerous transitions", () => {
    expect(canTransitionOrder("cancelled", "paid")).toBe(false);
    expect(canTransitionOrder("refunded", "refunded")).toBe(false);
    expect(canTransitionOrder("awaiting_payment", "shipped")).toBe(false);
    expect(canTransitionOrder("pending", "shipped")).toBe(false);
    expect(canTransitionOrder("expired", "paid")).toBe(false);
    expect(canTransitionOrder("delivered", "cancelled")).toBe(false);
  });
  it("terminal statuses have no exits", () => {
    for (const s of TERMINAL_ORDER_STATUSES) expect(ORDER_TRANSITIONS[s]).toHaveLength(0);
  });
  it("computes conditional-update sources", () => {
    expect(orderSourcesFor("paid").sort()).toEqual(["awaiting_payment", "payment_failed"]);
    expect(orderSourcesFor("cancelled")).not.toContain("delivered");
  });
  it("customers can only cancel before fulfilment", () => {
    expect(CUSTOMER_CANCELLABLE).toEqual(["pending", "awaiting_payment", "payment_failed"]);
  });
});

describe("payment state machine", () => {
  it("defines every status", () => {
    for (const s of PAYMENT_STATUSES) expect(PAYMENT_TRANSITIONS[s]).toBeDefined();
  });
  it("refunds only succeeded payments, once", () => {
    expect(canTransitionPayment("succeeded", "refunded")).toBe(true);
    expect(canTransitionPayment("refunded", "refunded")).toBe(false);
    expect(canTransitionPayment("pending", "refunded")).toBe(false);
  });
  it("does not resurrect cancelled payments", () => {
    expect(canTransitionPayment("cancelled", "succeeded")).toBe(false);
  });
  it("computes payment sources and sensitive admin transitions", () => {
    expect(paymentSourcesFor("refunded")).toEqual(["succeeded"]);
    expect(paymentSourcesFor("succeeded")).toContain("expired"); // late-payment reconciliation path only
    expect(SENSITIVE_TRANSITIONS).toEqual(["cancelled", "refunded"]);
  });
});
