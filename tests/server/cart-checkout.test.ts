import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Cart, OrderDetail, PaymentStatusResponse } from "@/lib/api/types";
import { GET as cartRoute, DELETE as cartClearRoute } from "@/app/api/v1/cart/route";
import { POST as cartItemsRoute } from "@/app/api/v1/cart/items/route";
import { PATCH as cartItemPatchRoute, DELETE as cartItemDeleteRoute } from "@/app/api/v1/cart/items/[itemId]/route";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";
import { GET as csrfRoute } from "@/app/api/v1/auth/csrf/route";
import { POST as ordersRoute } from "@/app/api/v1/orders/route";
import { GET as orderRoute } from "@/app/api/v1/orders/[number]/route";
import { POST as cancelRoute } from "@/app/api/v1/orders/[number]/cancel/route";
import { GET as myOrdersRoute } from "@/app/api/v1/orders/my-orders/route";
import { GET as paymentStatusRoute } from "@/app/api/v1/payments/status/[number]/route";
import { POST as mockCallbackRoute } from "@/app/api/v1/payments/mock/callback/route";
import { GET as mockCheckoutRoute } from "@/app/api/v1/payments/mock/checkout/[paymentId]/route";
import { POST as mockActionRoute } from "@/app/api/v1/payments/mock/action/route";
import { POST as idramCallbackRoute } from "@/app/api/v1/payments/idram/callback/route";
import { TestClient, addToCart, checkoutPayload, placeOrder, registeredUser, seed, setStock, shopper, signMock, stockOf, variantIds } from "../support/fixtures";

type CartRes = { data: Cart };

async function runJobs() {
  const { runJobsOnce } = await import("@/server/jobs");
  return runJobsOnce();
}

async function sendMock(body: Record<string, unknown>, signature?: string) {
  const raw = JSON.stringify(body);
  const c = new TestClient();
  return c.call<{ ok: boolean; result: string; reason?: string }>(mockCallbackRoute, "POST", "/api/v1/payments/mock/callback", {
    rawBody: raw,
    headers: { "content-type": "application/json", ...(signature !== "" ? { "x-mock-signature": signature ?? signMock(raw) } : {}) },
    origin: null,
    csrf: false,
  });
}

describe("cart", () => {
  beforeEach(async () => {
    await seed();
  });

  it("requires 18+ confirmation before adding items", async () => {
    const c = new TestClient();
    await c.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    const ids = await variantIds("AC-STD");
    const res = await c.call<{ error: { code: string } }>(cartItemsRoute, "POST", "/api/v1/cart/items", { body: { ...ids, quantity: 1 } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("AGE_CONFIRMATION_REQUIRED");
  });

  it("adds, updates, removes and clears with server-side prices", async () => {
    const c = await shopper();
    const added = await addToCart(c, "DA-30-3", 2);
    expect(added.status).toBe(201);
    const cart = (added.body as CartRes).data;
    expect(cart.items[0]).toMatchObject({ sku: "DA-30-3", unitPrice: 4900, quantity: 2, lineTotal: 9800, status: "ok" });
    expect(cart.totals).toMatchObject({ subtotal: 9800, shipping: 1000, total: 10800, vatAmount: 1800, shippingEstimated: true });

    const itemId = cart.items[0]!.id;
    const patched = await c.call<CartRes>(cartItemPatchRoute, "PATCH", `/api/v1/cart/items/${itemId}`, { body: { quantity: 3 }, params: { itemId } });
    expect(patched.body.data.items[0]!.quantity).toBe(3);
    expect(patched.body.data.totals.shipping).toBe(1000);

    const region = await c.call<CartRes>(cartRoute, "GET", "/api/v1/cart?region=syunik");
    expect(region.body.data.totals).toMatchObject({ shipping: 2000, shippingRegion: "syunik", shippingEstimated: false });

    await addToCart(c, "VPZ-STD", 1);
    const free = await c.call<CartRes>(cartRoute, "GET", "/api/v1/cart?region=syunik");
    expect(free.body.data.totals.shipping).toBe(0);
    expect(free.body.data.totals.amountToFreeShipping).toBe(0);

    const removed = await c.call<CartRes>(cartItemDeleteRoute, "DELETE", `/api/v1/cart/items/${itemId}`, { params: { itemId } });
    expect(removed.body.data.items).toHaveLength(1);
    const cleared = await c.call<CartRes>(cartClearRoute, "DELETE", "/api/v1/cart");
    expect(cleared.body.data.items).toHaveLength(0);
  });

  it("rejects quantities above availability with OUT_OF_STOCK details", async () => {
    const c = await shopper();
    const res = await addToCart(c, "TV-ONE", 2);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: { code: "OUT_OF_STOCK", details: [{ sku: "TV-ONE", requested: 2, available: 1 }] } });
    expect((await addToCart(c, "NF-STD", 1)).status).toBe(409);
  });

  it("ignores client-supplied prices (unknown fields rejected)", async () => {
    const c = await shopper();
    const ids = await variantIds("AC-STD");
    const res = await c.call(cartItemsRoute, "POST", "/api/v1/cart/items", { body: { ...ids, quantity: 1, price: 1 } });
    expect(res.status).toBe(422);
  });

  it("flags price changes, stock reductions and removed products on read", async () => {
    const c = await shopper();
    await addToCart(c, "DA-30-3", 3);
    await addToCart(c, "AP-STD", 1);
    await addToCart(c, "DAR-30-3", 1);
    const { Product } = await import("@/server/models");
    await Product.updateOne({ "variants.sku": "AP-STD" }, { $set: { "variants.$.salePrice": 19000 } });
    await setStock("DA-30-3", 2);
    await Product.updateOne({ slug: "dual-aroma" }, { $set: { status: "archived" } });
    const cart = (await c.call<CartRes>(cartRoute, "GET", "/api/v1/cart")).body.data;
    const bySku = Object.fromEntries(cart.items.map((i) => [i.slug, i]));
    expect(bySku["aeropulse"]).toMatchObject({ status: "price_changed", unitPrice: 19000, previousUnitPrice: 21500 });
    expect(bySku["double-apple"]).toMatchObject({ status: "insufficient_stock", available: 2 });
    expect(bySku["dual-aroma"]).toMatchObject({ status: "unavailable" });
    // unavailable / out-of-stock lines are excluded from totals; price-changed lines use the new price
    expect(cart.totals.subtotal).toBe(19000);
    expect(cart.issues).toHaveLength(3);
  });

  it("evaluates coupons server-side", async () => {
    const c = await shopper();
    await addToCart(c, "DA-30-3", 2);
    const ok = await c.call<CartRes>(cartRoute, "GET", "/api/v1/cart?coupon=welcome10");
    expect(ok.body.data.coupon).toEqual({ code: "WELCOME10", valid: true });
    expect(ok.body.data.totals.discount).toBe(980);
    const expired = await c.call<CartRes>(cartRoute, "GET", "/api/v1/cart?coupon=EXPIRED5");
    expect(expired.body.data.coupon).toEqual({ code: "EXPIRED5", valid: false, reason: "expired" });
    expect(expired.body.data.totals.discount).toBe(0);
  });

  it("isolates carts between visitors and merges the guest cart on login", async () => {
    const { client: userClient, email, password } = await registeredUser();
    await addToCart(userClient, "DA-30-3", 1);
    const guest = await shopper();
    await addToCart(guest, "DA-30-3", 2);
    await addToCart(guest, "AC-STD", 1);
    const other = await shopper();
    expect((await other.call<CartRes>(cartRoute, "GET", "/api/v1/cart")).body.data.items).toHaveLength(0);

    const login = await guest.call(loginRoute, "POST", "/api/v1/auth/login", { body: { email, password } });
    expect(login.status).toBe(200);
    const merged = (await guest.call<CartRes>(cartRoute, "GET", "/api/v1/cart")).body.data;
    const qty = Object.fromEntries(merged.items.map((i) => [i.sku, i.quantity]));
    expect(qty).toEqual({ "DA-30-3": 3, "AC-STD": 1 });
    // merging again is a no-op
    const again = (await userClient.call<CartRes>(cartRoute, "GET", "/api/v1/cart")).body.data;
    expect(again.items.map((i) => i.quantity).reduce((a, b) => a + b, 0)).toBe(4);
  });
});

describe("checkout (COD)", () => {
  beforeEach(async () => {
    await seed();
  });

  it("creates an order with server-computed totals, snapshot, consumed reservation and email", async () => {
    const c = await shopper();
    await addToCart(c, "DA-30-3", 2);
    const before = await stockOf("DA-30-3");
    const res = await placeOrder(c, { shipping: { region: "lori", city: "Vanadzor", line1: "Main 1" } });
    expect(res.status).toBe(201);
    const order = res.body.data.order;
    expect(order).toMatchObject({ status: "pending", total: 9800 + 2000 });
    expect(order.number).toMatch(/^VH-\d{6}-[A-Z0-9]{6}$/);
    expect(await stockOf("DA-30-3")).toBe(before - 2);

    const { Reservation, Order } = await import("@/server/models");
    const doc = await Order.findOne({ number: order.number }).lean();
    expect(doc!.items[0]).toMatchObject({ sku: "DA-30-3", unitPrice: 4900, quantity: 2, lineTotal: 9800 });
    expect(doc!.totals).toMatchObject({ subtotal: 9800, shipping: 2000, total: 11800, vatAmount: Math.floor((11800 * 20) / 120 + 0.5) });
    expect((await Reservation.find({ orderId: doc!._id }).lean()).map((r) => r.status)).toEqual(["consumed"]);

    // snapshot survives catalog price changes
    const { Product } = await import("@/server/models");
    await Product.updateOne({ "variants.sku": "DA-30-3" }, { $set: { "variants.$.price": 9999 } });
    const detail = await c.call<{ data: OrderDetail }>(orderRoute, "GET", `/api/v1/orders/${order.number}`, { params: { number: order.number } });
    expect(detail.body.data.items[0]!.unitPrice).toBe(4900);

    // cart emptied, confirmation email queued and delivered by the outbox
    expect((await c.call<CartRes>(cartRoute, "GET", "/api/v1/cart")).body.data.items).toHaveLength(0);
    await runJobs();
    const { CapturedEmail } = await import("@/server/models");
    expect(await CapturedEmail.countDocuments({ to: "ani@example.com", template: "order_confirmation" })).toBe(1);
  });

  it("validates required consent, region and body", async () => {
    const c = await shopper();
    await addToCart(c, "DA-30-3", 1);
    const cases: Record<string, unknown>[] = [
      { ...checkoutPayload(), ageConfirmed: false },
      { ...checkoutPayload(), termsAccepted: false },
      { ...checkoutPayload(), shipping: { region: "mars", city: "x", line1: "abc" } },
      { ...checkoutPayload(), customer: { firstName: "", lastName: "x", email: "bad", phone: "1" } },
      { ...checkoutPayload(), total: 1 },
    ];
    for (const body of cases) {
      const res = await c.call(ordersRoute, "POST", "/api/v1/orders", { body, headers: { "idempotency-key": randomUUID() } });
      expect(res.status).toBe(422);
    }
    const noKey = await c.call(ordersRoute, "POST", "/api/v1/orders", { body: checkoutPayload() });
    expect(noKey.status).toBe(422);
  });

  it("rejects an empty cart", async () => {
    const c = await shopper();
    const res = await placeOrder(c);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: { code: "CART_EMPTY" } });
  });

  it("is idempotent: same key → same order, different payload → 422", async () => {
    const c = await shopper();
    await addToCart(c, "AC-STD", 1);
    const key = randomUUID();
    const first = await placeOrder(c, {}, key);
    const second = await placeOrder(c, {}, key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.order.number).toBe(first.body.data.order.number);
    expect(await stockOf("AC-STD")).toBe(29);
    const reuse = await placeOrder(c, { paymentMethod: "mock" }, key);
    expect(reuse.status).toBe(422);
    expect(reuse.body).toMatchObject({ error: { code: "IDEMPOTENCY_KEY_REUSED" } });
    const { Order } = await import("@/server/models");
    expect(await Order.countDocuments({})).toBe(1);
  });

  it("applies a valid coupon and increments its usage atomically", async () => {
    const c = await shopper();
    await addToCart(c, "DA-30-3", 2);
    const res = await placeOrder(c, { couponCode: "WELCOME10" });
    expect(res.status).toBe(201);
    expect(res.body.data.order.total).toBe(9800 - 980 + 1000);
    const { Coupon } = await import("@/server/models");
    expect((await Coupon.findOne({ code: "WELCOME10" }).lean())!.usedCount).toBe(1);
    const c2 = await shopper();
    await addToCart(c2, "DA-30-3", 1);
    const bad = await placeOrder(c2, { couponCode: "EXPIRED5" });
    expect(bad.status).toBe(422);
  });

  it("refuses a disabled payment method", async () => {
    const c = await shopper();
    await addToCart(c, "AC-STD", 1);
    const res = await placeOrder(c, { paymentMethod: "idram" });
    expect(res.status).toBe(503);
    expect(await stockOf("AC-STD")).toBe(30);
  });

  it("customer cancellation restores stock exactly once and hides orders from strangers", async () => {
    const c = await shopper();
    await addToCart(c, "IGN-BLK", 3);
    const res = await placeOrder(c);
    const number = res.body.data.order.number;
    expect(await stockOf("IGN-BLK")).toBe(22);
    const stranger = await shopper();
    expect((await stranger.call(orderRoute, "GET", `/api/v1/orders/${number}`, { params: { number } })).status).toBe(404);
    expect((await stranger.call(cancelRoute, "POST", `/api/v1/orders/${number}/cancel`, { params: { number } })).status).toBe(404);
    expect((await stranger.call(paymentStatusRoute, "GET", `/api/v1/payments/status/${number}`, { params: { number } })).status).toBe(404);

    const cancelled = await c.call<{ data: OrderDetail }>(cancelRoute, "POST", `/api/v1/orders/${number}/cancel`, { params: { number } });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("cancelled");
    expect(await stockOf("IGN-BLK")).toBe(25);
    const twice = await c.call(cancelRoute, "POST", `/api/v1/orders/${number}/cancel`, { params: { number } });
    expect(twice.status).toBe(409);
    expect(await stockOf("IGN-BLK")).toBe(25);
  });

  it("signed-in users see their order history; others cannot", async () => {
    const { client } = await registeredUser();
    await addToCart(client, "AC-STD", 1);
    const res = await placeOrder(client);
    const list = await client.call<{ data: { number: string }[] }>(myOrdersRoute, "GET", "/api/v1/orders/my-orders");
    expect(list.body.data.map((o) => o.number)).toEqual([res.body.data.order.number]);
    const other = await registeredUser();
    expect((await other.client.call<{ data: unknown[] }>(myOrdersRoute, "GET", "/api/v1/orders/my-orders")).body.data).toEqual([]);
    const number = res.body.data.order.number;
    expect((await other.client.call(orderRoute, "GET", `/api/v1/orders/${number}`, { params: { number } })).status).toBe(404);
    expect((await new TestClient().call(myOrdersRoute, "GET", "/api/v1/orders/my-orders")).status).toBe(401);
  });
});

describe("online payments (mock provider)", () => {
  beforeEach(async () => {
    await seed();
  });

  async function onlineOrder(sku = "AP-STD", qty = 1) {
    const c = await shopper();
    await addToCart(c, sku, qty);
    const res = await placeOrder(c, { paymentMethod: "mock" });
    expect(res.status).toBe(201);
    return { c, number: res.body.data.order.number, total: res.body.data.order.total, res };
  }

  it("holds an active reservation, returns a redirect and reports an honest pending status", async () => {
    const { c, number, res } = await onlineOrder();
    expect(res.body.data.order.status).toBe("awaiting_payment");
    expect(res.body.data.payment.redirect?.url).toContain("/api/v1/payments/mock/checkout/");
    expect(await stockOf("AP-STD")).toBe(19);
    const status = await c.call<{ data: PaymentStatusResponse }>(paymentStatusRoute, "GET", `/api/v1/payments/status/${number}`, { params: { number } });
    expect(status.body.data).toMatchObject({ orderStatus: "awaiting_payment", paymentStatus: "requires_action" });
    expect(status.headers.get("cache-control")).toBe("no-store");
  });

  it("confirms payment only from a verified callback; duplicates are no-ops", async () => {
    const { number, total } = await onlineOrder();
    const event = { eventId: "evt-1", orderNumber: number, amount: total, currency: "AMD", outcome: "succeeded" };
    const first = await sendMock(event);
    expect(first.body).toMatchObject({ ok: true, result: "applied" });
    const dup = await sendMock(event);
    expect(dup.body).toMatchObject({ ok: true, result: "duplicate" });
    const { Order, Reservation, PaymentEvent, CapturedEmail } = await import("@/server/models");
    const order = await Order.findOne({ number }).lean();
    expect(order).toMatchObject({ status: "paid", paymentStatus: "succeeded" });
    expect((await Reservation.find({ orderId: order!._id }).lean()).map((r) => r.status)).toEqual(["consumed"]);
    expect(await PaymentEvent.countDocuments({ orderNumber: number })).toBe(1);
    expect(await stockOf("AP-STD")).toBe(19);
    await runJobs();
    await runJobs();
    expect(await CapturedEmail.countDocuments({ template: "payment_confirmed" })).toBe(1);
  });

  it("rejects forged, unsigned, wrong-amount and wrong-currency callbacks", async () => {
    const { number, total } = await onlineOrder();
    const base = { eventId: "evt-x", orderNumber: number, amount: total, currency: "AMD", outcome: "succeeded" };
    expect((await sendMock(base, "")).status).toBe(401);
    expect((await sendMock(base, "forged-signature")).status).toBe(401);
    const wrongAmount = await sendMock({ ...base, eventId: "evt-amt", amount: 1 });
    expect(wrongAmount.status).toBe(422);
    expect(wrongAmount.body.reason).toBe("amount_mismatch");
    expect((await sendMock({ ...base, eventId: "evt-cur", currency: "USD" })).status).toBe(422);
    expect((await sendMock({ ...base, eventId: "evt-ord", orderNumber: "VH-000000-AAAAAA" })).status).toBe(422);
    const { Order, AuditLog } = await import("@/server/models");
    expect((await Order.findOne({ number }).lean())!.status).toBe("awaiting_payment");
    expect(await AuditLog.countDocuments({ action: "payment.callback_rejected" })).toBeGreaterThanOrEqual(5);
  });

  it("a forged success redirect does not mark the order paid", async () => {
    const { c, number } = await onlineOrder();
    // The storefront success page only reads server state: simulate a user visiting it.
    const status = await c.call<{ data: PaymentStatusResponse }>(paymentStatusRoute, "GET", `/api/v1/payments/status/${number}?paid=true&status=succeeded`, { params: { number } });
    expect(status.body.data.paymentStatus).not.toBe("succeeded");
  });

  it("failure keeps the reservation until expiry; expiry restores stock once", async () => {
    const { number, total } = await onlineOrder("AP-STD", 2);
    expect((await sendMock({ eventId: "evt-f", orderNumber: number, amount: total, currency: "AMD", outcome: "failed" })).body.result).toBe("applied");
    const { Order } = await import("@/server/models");
    expect((await Order.findOne({ number }).lean())!.status).toBe("payment_failed");
    expect(await stockOf("AP-STD")).toBe(18);
    await Order.updateOne({ number }, { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    const { expireReservations } = await import("@/server/services/orders");
    expect(await expireReservations()).toBe(1);
    expect(await expireReservations()).toBe(0);
    expect(await stockOf("AP-STD")).toBe(20);
    expect((await Order.findOne({ number }).lean())).toMatchObject({ status: "expired", paymentStatus: "expired" });
  });

  it("late success after expiry re-reserves stock when available", async () => {
    const { number, total } = await onlineOrder("AP-STD", 1);
    const { Order } = await import("@/server/models");
    await Order.updateOne({ number }, { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    const { expireReservations } = await import("@/server/services/orders");
    await expireReservations();
    expect(await stockOf("AP-STD")).toBe(20);
    const res = await sendMock({ eventId: "evt-late", orderNumber: number, amount: total, currency: "AMD", outcome: "succeeded" });
    expect(res.body.result).toBe("applied");
    expect((await Order.findOne({ number }).lean())).toMatchObject({ status: "paid", paymentStatus: "succeeded" });
    expect(await stockOf("AP-STD")).toBe(19);
  });

  it("late success after the last unit was resold is flagged for reconciliation, never oversold", async () => {
    const { number, total } = await onlineOrder("TV-ONE", 1);
    const { Order } = await import("@/server/models");
    await Order.updateOne({ number }, { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    const { expireReservations } = await import("@/server/services/orders");
    await expireReservations();
    expect(await stockOf("TV-ONE")).toBe(1);
    const buyer = await shopper();
    await addToCart(buyer, "TV-ONE", 1);
    expect((await placeOrder(buyer)).status).toBe(201);
    expect(await stockOf("TV-ONE")).toBe(0);
    const late = await sendMock({ eventId: "evt-late2", orderNumber: number, amount: total, currency: "AMD", outcome: "succeeded" });
    expect(late.body).toMatchObject({ result: "reconciliation", reason: "late_payment_stock_unavailable" });
    const order = await Order.findOne({ number }).lean();
    expect(order).toMatchObject({ status: "expired", paymentStatus: "succeeded", reconciliation: { required: true } });
    expect(await stockOf("TV-ONE")).toBe(0);
  });

  it("payment after cancellation never revives the order", async () => {
    const { c, number, total } = await onlineOrder();
    await c.call(cancelRoute, "POST", `/api/v1/orders/${number}/cancel`, { params: { number } });
    const res = await sendMock({ eventId: "evt-c", orderNumber: number, amount: total, currency: "AMD", outcome: "succeeded" });
    expect(res.body.result).toBe("reconciliation");
    const { Order } = await import("@/server/models");
    expect((await Order.findOne({ number }).lean())).toMatchObject({ status: "cancelled", reconciliation: { required: true } });
    expect(await stockOf("AP-STD")).toBe(20);
  });

  it("the simulated provider page and action complete the flow and redirect to the status page", async () => {
    const { number } = await onlineOrder();
    const { PaymentTransaction } = await import("@/server/models");
    const payment = await PaymentTransaction.findOne({ orderNumber: number }).lean();
    const pid = String(payment!._id);
    const page = await new TestClient().call(mockCheckoutRoute, "GET", `/api/v1/payments/mock/checkout/${pid}`, { params: { paymentId: pid } });
    expect(page.status).toBe(200);
    expect(page.text).toContain(number);
    const action = await new TestClient().call(mockActionRoute, "POST", "/api/v1/payments/mock/action", {
      rawBody: new URLSearchParams({ paymentId: pid, outcome: "succeeded" }).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      csrf: false,
    });
    expect(action.status).toBe(303);
    expect(action.headers.get("location")).toContain(`/checkout/success?order=${number}`);
    const { Order } = await import("@/server/models");
    expect((await Order.findOne({ number }).lean())!.status).toBe("paid");
  });

  it("Idram callback is not mounted unless live credentials are configured", async () => {
    const res = await new TestClient().call(idramCallbackRoute, "POST", "/api/v1/payments/idram/callback", {
      rawBody: "EDP_PRECHECK=YES&EDP_BILL_NO=x",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      csrf: false,
      origin: null,
    });
    expect(res.status).toBe(404);
  });
});
