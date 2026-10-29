import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as cancelRoute } from "@/app/api/v1/orders/[number]/cancel/route";
import { POST as mockCallbackRoute } from "@/app/api/v1/payments/mock/callback/route";
import { TestClient, addToCart, placeOrder, seed, setStock, shopper, signMock, stockOf } from "../support/fixtures";

/**
 * BUILD §20.5 concurrency tests A–H, run against a real MongoDB replica set
 * (mongodb-memory-server) with independent sessions issuing synchronized requests.
 */

async function reservationsFor(sku: string) {
  const { Reservation } = await import("@/server/models");
  return Reservation.find({ sku }).lean();
}

async function sendMock(body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  return new TestClient().call<{ result: string }>(mockCallbackRoute, "POST", "/api/v1/payments/mock/callback", {
    rawBody: raw,
    headers: { "content-type": "application/json", "x-mock-signature": signMock(raw) },
    csrf: false,
    origin: null,
  });
}

describe("inventory concurrency (BUILD §20.5)", () => {
  beforeEach(async () => {
    await seed();
  });

  it("A — two buyers race for the final unit: exactly one wins", async () => {
    expect(await stockOf("TV-ONE")).toBe(1);
    const [a, b] = await Promise.all([shopper(), shopper()]);
    await Promise.all([addToCart(a, "TV-ONE", 1), addToCart(b, "TV-ONE", 1)]);
    const results = await Promise.all([placeOrder(a), placeOrder(b)]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    const loser = results.find((r) => r.status === 409)!;
    expect(loser.body).toMatchObject({ error: { code: "OUT_OF_STOCK", details: [{ sku: "TV-ONE", requested: 1, available: 0 }] } });
    expect(await stockOf("TV-ONE")).toBe(0);
    const res = await reservationsFor("TV-ONE");
    expect(res).toHaveLength(1);
    const { Order } = await import("@/server/models");
    expect(await Order.countDocuments({ "items.sku": "TV-ONE" })).toBe(1);
  });

  it("A' — ten buyers race for the final unit (online payment holds): still exactly one", async () => {
    const buyers = await Promise.all(Array.from({ length: 10 }, () => shopper()));
    await Promise.all(buyers.map((b) => addToCart(b, "TV-ONE", 1)));
    const results = await Promise.all(buyers.map((b, i) => placeOrder(b, { paymentMethod: i % 2 ? "mock" : "cod" })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
    expect(await stockOf("TV-ONE")).toBe(0);
    expect(await reservationsFor("TV-ONE")).toHaveLength(1);
  });

  it("B — limited multi-unit stock: total reserved never exceeds stock", async () => {
    await setStock("NX-STD", 5);
    const quantities = [2, 2, 2, 1, 3, 1];
    const buyers = await Promise.all(quantities.map(() => shopper()));
    await Promise.all(buyers.map((b, i) => addToCart(b, "NX-STD", quantities[i])));
    const results = await Promise.all(buyers.map((b) => placeOrder(b)));
    const reserved = results.reduce((sum, r, i) => (r.status === 201 ? sum + quantities[i]! : sum), 0);
    expect(reserved).toBeLessThanOrEqual(5);
    const remaining = await stockOf("NX-STD");
    expect(remaining).toBeGreaterThanOrEqual(0);
    expect(remaining + reserved).toBe(5);
    const res = await reservationsFor("NX-STD");
    expect(res.reduce((s, r) => s + r.quantity, 0)).toBe(reserved);
    // rejected requests left nothing behind
    const { Order } = await import("@/server/models");
    expect(await Order.countDocuments({})).toBe(results.filter((r) => r.status === 201).length);
  });

  it("C — duplicate idempotent request (sequential and concurrent) creates one order", async () => {
    const c = await shopper();
    await addToCart(c, "AC-STD", 2);
    const key = randomUUID();
    const concurrent = await Promise.all([placeOrder(c, {}, key), placeOrder(c, {}, key), placeOrder(c, {}, key)]);
    const ok = concurrent.filter((r) => r.status === 201 || r.status === 200);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    for (const r of concurrent) expect([200, 201, 409]).toContain(r.status);
    const numbers = new Set(ok.map((r) => r.body.data.order.number));
    expect(numbers.size).toBe(1);
    const again = await placeOrder(c, {}, key);
    expect(again.status).toBe(200);
    expect(again.body.data.order.number).toBe([...numbers][0]);
    expect(await stockOf("AC-STD")).toBe(28);
    const { Order } = await import("@/server/models");
    expect(await Order.countDocuments({})).toBe(1);
  });

  it("D — reservation expiration restores stock exactly once across repeated/concurrent runs", async () => {
    const c = await shopper();
    await addToCart(c, "AP-STD", 3);
    const res = await placeOrder(c, { paymentMethod: "mock" });
    const number = res.body.data.order.number;
    expect(await stockOf("AP-STD")).toBe(17);
    const { Order } = await import("@/server/models");
    await Order.updateOne({ number }, { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    const { expireReservations } = await import("@/server/services/orders");
    const counts = await Promise.all([expireReservations(), expireReservations(), expireReservations()]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
    expect(await expireReservations()).toBe(0);
    expect(await stockOf("AP-STD")).toBe(20);
    expect((await reservationsFor("AP-STD")).map((r) => r.status)).toEqual(["expired"]);
  });

  it("E — cancellation races payment confirmation: one terminal outcome, no double restore", async () => {
    for (let round = 0; round < 3; round += 1) {
      await seed();
      const c = await shopper();
      await addToCart(c, "AP-STD", 2);
      const order = await placeOrder(c, { paymentMethod: "mock" });
      const { number, total } = order.body.data.order;
      const [cancel, pay] = await Promise.all([
        c.call(cancelRoute, "POST", `/api/v1/orders/${number}/cancel`, { params: { number } }),
        sendMock({ eventId: `race-${round}`, orderNumber: number, amount: total, currency: "AMD", outcome: "succeeded" }),
      ]);
      const { Order } = await import("@/server/models");
      const final = (await Order.findOne({ number }).lean())!;
      const stock = await stockOf("AP-STD");
      if (final.status === "paid") {
        expect(cancel.status).toBe(409);
        expect(stock).toBe(18); // consumed once
      } else {
        expect(final.status).toBe("cancelled");
        expect(cancel.status).toBe(200);
        expect(stock).toBe(20); // restored once
        expect(pay.body.result).toBe("reconciliation"); // money arrived for a cancelled order → manual review
      }
      const res = await reservationsFor("AP-STD");
      expect(res).toHaveLength(1);
    }
  });

  it("F — duplicate and concurrent payment callbacks apply once", async () => {
    const c = await shopper();
    await addToCart(c, "AP-STD", 1);
    const order = await placeOrder(c, { paymentMethod: "mock" });
    const { number, total } = order.body.data.order;
    const event = { eventId: "dup-evt", orderNumber: number, amount: total, currency: "AMD", outcome: "succeeded" };
    const results = await Promise.all(Array.from({ length: 6 }, () => sendMock(event)));
    expect(results.filter((r) => r.body.result === "applied")).toHaveLength(1);
    expect(results.filter((r) => r.body.result === "duplicate")).toHaveLength(5);
    // a different event id for the same payment is also a no-op once paid
    expect((await sendMock({ ...event, eventId: "dup-evt-2" })).body.result).toBe("duplicate");
    const { Order, PaymentEvent, Outbox } = await import("@/server/models");
    expect((await Order.findOne({ number }).lean())!.status).toBe("paid");
    expect(await stockOf("AP-STD")).toBe(19);
    // the six deliveries of the same event collapse to one record; the distinct event is logged but changes nothing
    expect(await PaymentEvent.countDocuments({ orderNumber: number, eventKey: "mock:dup-evt" })).toBe(1);
    expect(await PaymentEvent.countDocuments({ orderNumber: number })).toBe(2);
    expect(await Outbox.countDocuments({ dedupeKey: `email:payment-confirmed:${number}` })).toBe(1);
  });

  it("G — multi-variant cart where one variant runs out: all-or-nothing", async () => {
    const c = await shopper();
    await addToCart(c, "DA-30-3", 2);
    await addToCart(c, "IGN-BLK", 1);
    await addToCart(c, "VM-MELON-20", 3);
    const beforeDa = await stockOf("DA-30-3");
    const beforeIgn = await stockOf("IGN-BLK");
    await setStock("VM-MELON-20", 1); // sold elsewhere meanwhile
    const res = await placeOrder(c);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: { code: "OUT_OF_STOCK", details: [{ sku: "VM-MELON-20", requested: 3, available: 1 }] } });
    expect(await stockOf("DA-30-3")).toBe(beforeDa);
    expect(await stockOf("IGN-BLK")).toBe(beforeIgn);
    expect(await stockOf("VM-MELON-20")).toBe(1);
    const { Order, Reservation } = await import("@/server/models");
    expect(await Order.countDocuments({})).toBe(0);
    expect(await Reservation.countDocuments({})).toBe(0);
  });

  it("H — failure in the middle of reservation processing rolls back and a retry is idempotent", async () => {
    const c = await shopper();
    await addToCart(c, "DA-30-3", 1);
    await addToCart(c, "AC-STD", 1);
    const inventory = await import("@/server/services/inventory");
    const realDecrement = inventory.decrementStock;
    let calls = 0;
    const spy = vi.spyOn(inventory, "decrementStock").mockImplementation(async (...args) => {
      calls += 1;
      if (calls === 2) throw new Error("simulated crash after first decrement");
      return realDecrement(...args);
    });
    const key = randomUUID();
    const crashed = await placeOrder(c, {}, key);
    expect(crashed.status).toBe(500);
    spy.mockRestore();
    expect(await stockOf("DA-30-3")).toBe(40);
    expect(await stockOf("AC-STD")).toBe(30);
    const { Order, Reservation } = await import("@/server/models");
    expect(await Order.countDocuments({})).toBe(0);
    expect(await Reservation.countDocuments({})).toBe(0);
    const retried = await placeOrder(c, {}, key);
    expect(retried.status).toBe(201);
    const replay = await placeOrder(c, {}, key);
    expect(replay.status).toBe(200);
    expect(await stockOf("DA-30-3")).toBe(39);
    expect(await stockOf("AC-STD")).toBe(29);
    expect(await Order.countDocuments({})).toBe(1);
  });
});
