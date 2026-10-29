import { describe, expect, it, vi } from "vitest";
import { api, ApiError, buildQuery, setCsrfToken } from "@/lib/api/client";
import { parseCatalogParams, serializeCatalogQuery, updateQuery, hasActiveFilters } from "@/lib/catalog-query";
import { checkoutSchema, fieldForApiPath, normalizeArmenianPhone } from "@/lib/checkout-schema";
import { isStrongPassword } from "@/lib/auth-schema";
import { json, mockFetch } from "./render";

describe("api client", () => {
  it("fetches a CSRF token before the first mutation and sends it as a header", async () => {
    setCsrfToken(null);
    const { calls } = mockFetch({
      "GET /auth/csrf": () => json({ data: { csrfToken: "abc.def" } }),
      "POST /newsletter": () => new Response(null, { status: 202 }),
    });
    await api("/newsletter", { method: "POST", body: { email: "a@b.am" } });
    const post = calls.find((c) => c.method === "POST")!;
    expect(new Headers(post.init?.headers).get("X-CSRF-Token")).toBe("abc.def");
  });

  it("refreshes the token once and retries on CSRF_INVALID", async () => {
    setCsrfToken("stale.token");
    let attempts = 0;
    mockFetch({
      "GET /auth/csrf": () => json({ data: { csrfToken: "fresh.token" } }),
      "POST /contact": (init) => {
        attempts += 1;
        const token = new Headers(init?.headers).get("X-CSRF-Token");
        return token === "fresh.token" ? json({ data: { id: "1" } }, 201) : json({ error: { code: "CSRF_INVALID", message: "x" } }, 403);
      },
    });
    await expect(api("/contact", { method: "POST", body: {} })).resolves.toEqual({ id: "1" });
    expect(attempts).toBe(2);
  });

  it("maps network failures and timeouts to explicit codes", async () => {
    setCsrfToken("t.t");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(api("/cart")).rejects.toMatchObject({ code: "NETWORK" });
    vi.stubGlobal(
      "fetch",
      vi.fn((_u: string, init: RequestInit) => new Promise((_r, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("t", "TimeoutError"))))),
    );
    await expect(api("/cart", { timeoutMs: 20 })).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("surfaces structured errors with field details and Retry-After", async () => {
    mockFetch({
      "GET /cart": () => json({ error: { code: "RATE_LIMITED", message: "slow down", requestId: "r1" } }, 429, { "Retry-After": "30" }),
    });
    const err = (await api("/cart").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryAfter).toBe(30);
    expect(err.requestId).toBe("r1");
  });

  it("serializes query arrays as comma lists and drops empty values", () => {
    expect(buildQuery({ a: [1, 2], b: "", c: undefined, d: true })).toBe("?a=1%2C2&d=true");
  });
});

describe("catalog URL state", () => {
  it("drops malformed and malicious values instead of throwing", () => {
    const q = parseCatalogParams(
      new URLSearchParams("sort=DROP&page=-3&pageSize=999&category=pods,%24ne,<script>&nicotine=3,abc,999&minPrice=50000&maxPrice=100&inStock=yes"),
    );
    expect(q.sort).toBeUndefined();
    expect(q.page).toBeUndefined();
    expect(q.pageSize).toBeUndefined();
    expect(q.category).toEqual(["pods"]);
    expect(q.nicotine).toEqual([3]);
    expect(q).toMatchObject({ minPrice: 100, maxPrice: 50000 });
    expect(q.inStock).toBeUndefined();
  });

  it("round-trips a query with a stable, minimal string", () => {
    const q = parseCatalogParams({ category: "e-juices,coils", sort: "price-asc", page: "2", inStock: "true" });
    expect(serializeCatalogQuery(q)).toBe("category=coils%2Ce-juices&inStock=true&sort=price-asc&page=2");
    expect(serializeCatalogQuery({ sort: "newest", pageSize: 12 })).toBe("");
  });

  it("resets pagination whenever a filter changes", () => {
    const next = updateQuery({ page: 4, category: ["pods"] }, { brand: ["uwell"] });
    expect(next.page).toBeUndefined();
    expect(hasActiveFilters(next)).toBe(true);
    expect(updateQuery({ page: 2 }, { page: 3 }).page).toBe(3);
  });
});

describe("checkout validation", () => {
  const messages = { required: "req", email: "email", phone: "phone", max: () => "max", region: "region", ageRequired: "age", termsRequired: "terms" };
  const schema = checkoutSchema(messages, ["yerevan", "lori"]);
  const valid = {
    firstName: "Ani",
    lastName: "Petrosyan",
    email: "ani@example.am",
    phone: "091 23 45 67",
    region: "yerevan",
    city: "Yerevan",
    line1: "Abovyan 1",
    line2: "",
    notes: "",
    paymentMethod: "cod" as const,
    ageConfirmed: true,
    termsAccepted: true,
    saveAddress: false,
  };

  it("normalizes Armenian phone numbers", () => {
    expect(normalizeArmenianPhone("+374 91 234567")).toBe("+37491234567");
    expect(normalizeArmenianPhone("091-23-45-67")).toBe("+37491234567");
    expect(normalizeArmenianPhone("12345")).toBeNull();
  });

  it("requires adult confirmation, terms and a known region", () => {
    expect(schema.safeParse(valid).success).toBe(true);
    const bad = schema.safeParse({ ...valid, ageConfirmed: false, termsAccepted: false, region: "mars" });
    expect(bad.success).toBe(false);
    const messagesOut = bad.success ? [] : bad.error.issues.map((i) => i.message);
    expect(messagesOut).toEqual(expect.arrayContaining(["age", "terms", "region"]));
  });

  it("maps API field paths to form fields", () => {
    expect(fieldForApiPath("customer.email")).toBe("email");
    expect(fieldForApiPath("shipping.line1")).toBe("line1");
    expect(fieldForApiPath("items.0.price")).toBeNull();
  });
});

describe("password policy (client mirror)", () => {
  it("requires 10+ characters mixing letters with digits or symbols", () => {
    expect(isStrongPassword("short1")).toBe(false);
    expect(isStrongPassword("onlyletterslong")).toBe(false);
    expect(isStrongPassword("1234567890123")).toBe(false);
    expect(isStrongPassword("vape-hub-2026")).toBe(true);
    expect(isStrongPassword("Գաղտնաբառ2026")).toBe(true);
  });
});
