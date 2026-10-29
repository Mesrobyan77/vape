import { beforeAll, describe, expect, it, vi } from "vitest";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";
import { POST as registerRoute } from "@/app/api/v1/auth/register/route";
import { GET as csrfRoute } from "@/app/api/v1/auth/csrf/route";
import { POST as contactRoute } from "@/app/api/v1/contact/route";
import { POST as newsletterRoute } from "@/app/api/v1/newsletter/route";
import { GET as cartRoute } from "@/app/api/v1/cart/route";
import { PATCH as cartItemRoute } from "@/app/api/v1/cart/items/[itemId]/route";
import { GET as healthRoute } from "@/app/api/health/route";
import { GET as readyRoute } from "@/app/api/ready/route";
import { POST as cronRoute } from "@/app/api/v1/cron/run/route";
import { GET as testGetRoute, POST as testPostRoute } from "@/app/api/v1/test-support/[action]/route";
import { GET as productsRoute } from "@/app/api/v1/products/route";
import type { Cart } from "@/lib/api/types";
import { STRONG_PASSWORD, TestClient, addToCart, registeredUser, seed, shopper } from "../support/fixtures";

describe("request security", () => {
  beforeAll(async () => {
    await seed();
  });

  it("rejects mutations without a CSRF token, with a wrong token, or from a foreign origin", async () => {
    const c = new TestClient();
    await c.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    const body = { email: "a@example.com", password: "Whatever-123" };
    const missing = await c.call<{ error: { code: string } }>(loginRoute, "POST", "/api/v1/auth/login", { body, csrf: false });
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe("CSRF_INVALID");
    const wrong = await c.call(loginRoute, "POST", "/api/v1/auth/login", { body, csrf: false, headers: { "x-csrf-token": "forged.token" } });
    expect(wrong.status).toBe(403);
    const foreign = await c.call<{ error: { code: string } }>(loginRoute, "POST", "/api/v1/auth/login", { body, origin: "https://evil.example" });
    expect(foreign.status).toBe(403);
    expect(foreign.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
    const noOrigin = await c.call(loginRoute, "POST", "/api/v1/auth/login", { body, origin: null });
    expect(noOrigin.status).toBe(403);
    // a token issued for one session cannot be used with another session
    const other = new TestClient();
    await other.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    const crossed = await c.call(loginRoute, "POST", "/api/v1/auth/login", { body, csrf: false, headers: { "x-csrf-token": other.cookies.get("vh_csrf")! } });
    expect(crossed.status).toBe(403);
  });

  it("neutralizes NoSQL operator injection payloads", async () => {
    const c = new TestClient();
    await c.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    const attacks = [
      { email: { $ne: null }, password: { $ne: null } },
      { email: "a@example.com", password: { $gt: "" } },
      { email: { $regex: ".*" }, password: "x" },
    ];
    for (const body of attacks) {
      const res = await c.call(loginRoute, "POST", "/api/v1/auth/login", { body });
      expect(res.status).toBe(422);
    }
    const q = await c.call(productsRoute, "GET", "/api/v1/products?brand[$ne]=x&sort[$gt]=1");
    expect([200, 422]).toContain(q.status);
  });

  it("rejects oversized and malformed bodies", async () => {
    const c = new TestClient();
    await c.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    const huge = await c.call(contactRoute, "POST", "/api/v1/contact", { body: { name: "x", email: "x@example.com", subject: "hi", message: "y".repeat(200_000) } });
    expect(huge.status).toBe(413);
    const malformed = await c.call(contactRoute, "POST", "/api/v1/contact", { rawBody: "{not json", headers: { "content-type": "application/json" } });
    expect(malformed.status).toBe(400);
  });

  it("prevents cross-user cart manipulation", async () => {
    const owner = await shopper();
    const added = await addToCart(owner, "DA-30-3", 1);
    const itemId = (added.body as { data: Cart }).data.items[0]!.id;
    const attacker = await shopper();
    const res = await attacker.call(cartItemRoute, "PATCH", `/api/v1/cart/items/${itemId}`, { body: { quantity: 5 }, params: { itemId } });
    expect(res.status).toBe(404);
    const ownerCart = await owner.call<{ data: Cart }>(cartRoute, "GET", "/api/v1/cart");
    expect(ownerCart.body.data.items[0]!.quantity).toBe(1);
  });

  it("does not leak secrets or stack traces in responses", async () => {
    const c = new TestClient();
    await c.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    const { client } = await registeredUser();
    const me = await client.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    const bodies = [me.text, (await c.call(productsRoute, "GET", "/api/v1/products?sort=bad")).text];
    for (const t of bodies) {
      expect(t).not.toMatch(/passwordHash|argon2|test-mock-secret|mongodb:\/\/|at .*\.ts:\d+/);
    }
    const { User } = await import("@/server/models");
    const stored = await User.findOne({}).lean();
    expect(stored!.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("session cookies are HttpOnly + SameSite=Lax and never exposed in bodies", async () => {
    const c = new TestClient();
    const res = await c.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    const cookies = res.headers.getSetCookie().join("\n");
    expect(cookies).toMatch(/vh_sid=[^;]+;.*HttpOnly/i);
    expect(cookies).toMatch(/SameSite=lax/i);
    expect(res.text).not.toContain(c.cookies.get("vh_sid")!);
  });

  it("logs never contain passwords or tokens", async () => {
    const spy = vi.spyOn(console, "log");
    const warn = vi.spyOn(console, "warn");
    const err = vi.spyOn(console, "error");
    const c = await shopper();
    await c.call(registerRoute, "POST", "/api/v1/auth/register", { body: { email: "logcheck@example.com", password: STRONG_PASSWORD, name: "L" } });
    await c.call(loginRoute, "POST", "/api/v1/auth/login", { body: { email: "logcheck@example.com", password: STRONG_PASSWORD } });
    const all = [...spy.mock.calls, ...warn.mock.calls, ...err.mock.calls].flat().join("\n");
    expect(all).not.toContain(STRONG_PASSWORD);
    expect(all).not.toContain(c.cookies.get("vh_sid") ?? "never");
    spy.mockRestore();
    warn.mockRestore();
    err.mockRestore();
  });

  it("contact honeypot, validation and newsletter enumeration safety", async () => {
    const c = await shopper();
    const bot = await c.call<{ data: { id: string | null } }>(contactRoute, "POST", "/api/v1/contact", { body: { name: "Bot", email: "b@example.com", subject: "Hello", message: "Buy cheap stuff now!!!", website: "http://spam" } });
    expect(bot.status).toBe(201);
    expect(bot.body.data.id).toBeNull();
    const real = await c.call<{ data: { id: string } }>(contactRoute, "POST", "/api/v1/contact", { body: { name: "Ani", email: "Ani@Example.com", subject: "Delivery", message: "Do you deliver to Gyumri on weekends?", locale: "hy" } });
    expect(real.status).toBe(201);
    expect(real.body.data.id).toMatch(/^[a-f0-9]{24}$/);
    const n1 = await c.call(newsletterRoute, "POST", "/api/v1/newsletter", { body: { email: "news@example.com" } });
    const n2 = await c.call(newsletterRoute, "POST", "/api/v1/newsletter", { body: { email: "NEWS@example.com" } });
    expect(n1.status).toBe(202);
    expect(n2.body).toEqual(n1.body);
  });

  it("registration rate limit returns 429", async () => {
    const c = await shopper("198.51.100.9");
    let status = 0;
    for (let i = 0; i < 12; i += 1) {
      status = (await c.call(registerRoute, "POST", "/api/v1/auth/register", { body: { email: `r${i}@example.com`, password: STRONG_PASSWORD, name: "R" } })).status;
    }
    expect(status).toBe(429);
  });
});

describe("operational and test-only endpoints", () => {
  it("health and readiness expose no configuration", async () => {
    const health = await healthRoute();
    expect(await health.json()).toEqual({ status: "ok" });
    const ready = await readyRoute();
    const body = (await ready.json()) as Record<string, unknown>;
    expect(body).toEqual({ status: "ready", checks: { database: "ok" } });
  });

  it("cron requires the bearer secret", async () => {
    const c = new TestClient();
    expect((await c.call(cronRoute, "POST", "/api/v1/cron/run", { csrf: false })).status).toBe(401);
  });

  it("test-support endpoints require the token and are hidden otherwise", async () => {
    const c = new TestClient();
    expect((await c.call(testGetRoute, "GET", "/api/v1/test-support/emails", { params: { action: "emails" } })).status).toBe(404);
    expect((await c.call(testPostRoute, "POST", "/api/v1/test-support/reset", { params: { action: "reset" }, csrf: false })).status).toBe(404);
    const ok = await c.call(testGetRoute, "GET", "/api/v1/test-support/emails", { params: { action: "emails" }, headers: { "x-test-token": "test-token" } });
    expect(ok.status).toBe(200);
    const { setConfig, loadConfig } = await import("@/server/config");
    setConfig({ ...loadConfig(), isProduction: true });
    const prod = await c.call(testGetRoute, "GET", "/api/v1/test-support/emails", { params: { action: "emails" }, headers: { "x-test-token": "test-token" } });
    expect(prod.status).toBe(404);
    setConfig(null);
  });
});
