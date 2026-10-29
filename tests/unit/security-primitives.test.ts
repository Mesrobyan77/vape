import { afterEach, describe, expect, it } from "vitest";
import { ConfigError, loadConfig, setConfig } from "@/server/config";
import { decrypt, encrypt, safeEqual, stableHash } from "@/server/crypto";
import { AppError, toAppError } from "@/server/errors";
import { redact } from "@/server/logger";
import { normalizeEmail, passwordProblems } from "@/server/auth/passwords";
import { issueCsrfToken, verifyCsrfToken } from "@/server/auth/session";
import { idramChecksum, parseIdramAmount, verifyIdramChecksum } from "@/server/payments/idram";
import { normalizePexels } from "@/server/services/media";
import { checkoutRequestHash, generateOrderNumber, ORDER_NUMBER_RE } from "@/server/services/orders";
import type { CheckoutRequest } from "@/lib/api/types";

afterEach(() => setConfig(null));

const prodEnv = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SITE_URL: "https://shop.example.am",
  MONGODB_URI: "mongodb+srv://example",
  SESSION_SECRET: "x".repeat(40),
  MFA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
} as const;

describe("configuration validation", () => {
  it("accepts a complete production configuration", () => {
    const cfg = loadConfig({ ...prodEnv } as NodeJS.ProcessEnv);
    expect(cfg.isProduction).toBe(true);
    expect(cfg.rateLimitStore).toBe("mongo");
    expect(cfg.e2eTestToken).toBeUndefined();
  });
  it.each([
    ["MONGODB_URI", { MONGODB_URI: "" }],
    ["SESSION_SECRET", { SESSION_SECRET: "" }],
    ["SESSION_SECRET", { SESSION_SECRET: "short" }],
    ["MFA_ENCRYPTION_KEY", { MFA_ENCRYPTION_KEY: "" }],
    ["PAYMENT_MODE", { PAYMENT_MODE: "mock" }],
    ["E2E_TEST_API_TOKEN", { E2E_TEST_API_TOKEN: "abc" }],
    ["RATE_LIMIT_DISABLED", { RATE_LIMIT_DISABLED: "true" }],
    ["NEXT_PUBLIC_SITE_URL", { NEXT_PUBLIC_SITE_URL: "http://shop.example.am" }],
  ])("refuses to start in production without/with bad %s", (name, override) => {
    let error: unknown;
    try {
      loadConfig({ ...prodEnv, ...override } as unknown as NodeJS.ProcessEnv);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).message).toContain(name);
    // Values are never echoed.
    expect((error as ConfigError).message).not.toContain("mongodb+srv://example");
  });
  it("uses development fallbacks only outside production", () => {
    const cfg = loadConfig({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
    expect(cfg.sessionSecret.length).toBeGreaterThan(20);
    expect(cfg.paymentMode).toBe("disabled");
  });
});

describe("crypto helpers", () => {
  it("encrypts with AES-256-GCM and detects tampering", () => {
    const key = Buffer.alloc(32, 9);
    const sealed = encrypt("TOTPSECRET", key);
    expect(decrypt(sealed, key)).toBe("TOTPSECRET");
    const parts = sealed.split(".");
    parts[2] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."), key)).toThrow();
  });
  it("safeEqual compares without early exit semantics", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
  it("stableHash ignores key order", () => {
    expect(stableHash({ a: 1, b: { c: 2, d: 3 } })).toBe(stableHash({ b: { d: 3, c: 2 }, a: 1 }));
  });
});

describe("CSRF tokens", () => {
  it("are bound to the session hash", () => {
    const token = issueCsrfToken("session-a");
    expect(verifyCsrfToken("session-a", token)).toBe(true);
    expect(verifyCsrfToken("session-b", token)).toBe(false);
  });
  it("reject malformed tokens", () => {
    expect(verifyCsrfToken("s", "")).toBe(false);
    expect(verifyCsrfToken("s", "abc")).toBe(false);
    expect(verifyCsrfToken("s", "a.b.c")).toBe(false);
    expect(verifyCsrfToken("s", "x".repeat(300))).toBe(false);
  });
});

describe("accounts", () => {
  it("normalizes emails", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
    expect(normalizeEmail("ｕser@example.com")).toBe("user@example.com"); // NFKC full-width
  });
  it("enforces the password policy", () => {
    expect(passwordProblems("short1A")).toContain("too_short");
    expect(passwordProblems("alllowercaseletters")).toContain("too_simple");
    expect(passwordProblems("correct horse battery 9")).toEqual([]);
    expect(passwordProblems("A".repeat(129) + "1")).toContain("too_long");
  });
});

describe("error mapping", () => {
  it("maps duplicate keys to 409 without leaking internals", () => {
    const err = Object.assign(new Error("E11000 duplicate key collection: vapehub.users"), { code: 11000, keyPattern: { email: 1 } });
    const mapped = toAppError(err);
    expect(mapped.status).toBe(409);
    expect(mapped.message).not.toContain("vapehub");
    expect(mapped.details).toEqual([{ path: "email" }]);
  });
  it("maps cast errors to 400 and unknown errors to a generic 500", () => {
    expect(toAppError(Object.assign(new Error("Cast to ObjectId failed"), { name: "CastError" })).status).toBe(400);
    const unknown = toAppError(new Error("secret internal detail"));
    expect(unknown.status).toBe(500);
    expect(unknown.message).not.toContain("secret");
  });
  it("passes AppErrors through", () => {
    const e = new AppError("OUT_OF_STOCK");
    expect(toAppError(e)).toBe(e);
  });
});

describe("log redaction", () => {
  it("redacts secrets, tokens, cookies and passwords", () => {
    const out = redact({ password: "p", headers: { cookie: "vh_sid=abc", authorization: "Bearer x" }, csrfToken: "t", nested: { apiKey: "k", ok: 1 } }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toMatch(/"p"|abc|Bearer x|"t"|"k"/);
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
  });
});

describe("Idram checksum", () => {
  const fields = { recAccount: "110000601", amount: "12500.00", secretKey: "SECRET", billNo: "VH-261023-ABCDEF", payerAccount: "990000001", transId: "00000000000001", transDate: "23/10/2026" };
  it("is MD5 over the documented field order, uppercase hex", () => {
    const sum = idramChecksum(fields);
    expect(sum).toMatch(/^[0-9A-F]{32}$/);
    expect(verifyIdramChecksum(sum.toLowerCase(), sum)).toBe(true);
  });
  it("changes when any field (e.g. amount) is altered", () => {
    expect(idramChecksum({ ...fields, amount: "1.00" })).not.toBe(idramChecksum(fields));
    expect(idramChecksum({ ...fields, secretKey: "OTHER" })).not.toBe(idramChecksum(fields));
  });
  it("parses only whole-dram amounts", () => {
    expect(parseIdramAmount("12500.00")).toBe(12500);
    expect(parseIdramAmount("12500")).toBe(12500);
    expect(parseIdramAmount("12500.50")).toBeNull();
    expect(parseIdramAmount("-1")).toBeNull();
    expect(parseIdramAmount("1e5")).toBeNull();
  });
});

describe("Pexels normalization", () => {
  it("keeps only safe, expected fields with attribution", () => {
    const out = normalizePexels({
      photos: [
        {
          id: 1,
          width: 100,
          height: 80,
          alt: "Smoke",
          photographer: "Ann",
          photographer_url: "https://www.pexels.com/@ann",
          url: "https://www.pexels.com/photo/1",
          src: { medium: "https://images.pexels.com/1-m.jpg", large: "https://images.pexels.com/1-l.jpg", original: "x" },
          secret: "should-not-pass",
        },
        { id: 2, width: 1, height: 1, src: { medium: "https://evil.example/x.jpg", large: "https://evil.example/y.jpg" } },
        { id: "bad" },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      id: 1,
      width: 100,
      height: 80,
      alt: "Smoke",
      photographer: "Ann",
      photographerUrl: "https://www.pexels.com/@ann",
      pexelsUrl: "https://www.pexels.com/photo/1",
      src: { medium: "https://images.pexels.com/1-m.jpg", large: "https://images.pexels.com/1-l.jpg" },
    });
  });
  it("tolerates malformed payloads", () => {
    expect(normalizePexels(null)).toEqual([]);
    expect(normalizePexels({ photos: "nope" })).toEqual([]);
  });
});

describe("orders helpers", () => {
  it("generates human-readable order numbers", () => {
    const n = generateOrderNumber(new Date(Date.UTC(2026, 9, 23)));
    expect(n).toMatch(ORDER_NUMBER_RE);
    expect(n.startsWith("VH-261023-")).toBe(true);
  });
  it("hashes equivalent checkout payloads identically (idempotency)", () => {
    const base: CheckoutRequest = {
      customer: { firstName: "A", lastName: "B", email: "A@Example.com", phone: "+37499000000" },
      shipping: { region: "yerevan", city: "Yerevan", line1: "Main 1" },
      paymentMethod: "cod",
      ageConfirmed: true,
      termsAccepted: true,
      locale: "hy",
    };
    expect(checkoutRequestHash(base)).toBe(checkoutRequestHash({ ...base, customer: { ...base.customer, email: "a@example.com" }, shipping: { ...base.shipping, line2: "" } }));
    expect(checkoutRequestHash(base)).not.toBe(checkoutRequestHash({ ...base, paymentMethod: "mock" }));
  });
});
