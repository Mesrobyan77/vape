import { createHmac, randomUUID } from "node:crypto";
import { generateSecret, generateSync } from "otplib";
import { expect } from "vitest";
import type { CheckoutRequest } from "@/lib/api/types";
import { TestClient, type ApiResult } from "./client";

import { GET as csrfRoute } from "@/app/api/v1/auth/csrf/route";
import { POST as ageRoute } from "@/app/api/v1/compliance/age-confirmation/route";
import { POST as cartItemsRoute } from "@/app/api/v1/cart/items/route";
import { POST as ordersRoute } from "@/app/api/v1/orders/route";
import { POST as registerRoute } from "@/app/api/v1/auth/register/route";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";
import { POST as mfaVerifyRoute } from "@/app/api/v1/auth/mfa/verify/route";

export { TestClient };

export async function seed() {
  const { seedDatabase } = await import("@/server/seed");
  return seedDatabase({ reset: true });
}

export async function variantIds(sku: string): Promise<{ productId: string; variantId: string }> {
  const { Product } = await import("@/server/models");
  const p = await Product.findOne({ "variants.sku": sku.toUpperCase() }).lean();
  const v = p?.variants.find((x) => x.sku === sku.toUpperCase());
  if (!p || !v) throw new Error(`unknown sku ${sku}`);
  return { productId: String(p._id), variantId: String(v._id) };
}

export async function stockOf(sku: string): Promise<number> {
  const { Product } = await import("@/server/models");
  const p = await Product.findOne({ "variants.sku": sku.toUpperCase() }).lean();
  return p!.variants.find((x) => x.sku === sku.toUpperCase())!.stock;
}

export async function setStock(sku: string, stock: number): Promise<void> {
  const { Product } = await import("@/server/models");
  await Product.updateOne({ "variants.sku": sku.toUpperCase() }, { $set: { "variants.$.stock": stock } });
}

/** Anonymous shopper with a session, CSRF token and 18+ confirmation. */
export async function shopper(ip?: string): Promise<TestClient> {
  const c = new TestClient(ip);
  const csrf = await c.call(csrfRoute, "GET", "/api/v1/auth/csrf");
  expect(csrf.status).toBe(200);
  const age = await c.call(ageRoute, "POST", "/api/v1/compliance/age-confirmation", { body: { confirmed: true } });
  expect(age.status).toBe(204);
  return c;
}

export async function addToCart(c: TestClient, sku: string, quantity = 1): Promise<ApiResult> {
  const ids = await variantIds(sku);
  return c.call(cartItemsRoute, "POST", "/api/v1/cart/items", { body: { ...ids, quantity } });
}

export function checkoutPayload(over: Partial<CheckoutRequest> = {}): CheckoutRequest {
  return {
    customer: { firstName: "Ani", lastName: "Petrosyan", email: "ani@example.com", phone: "+37499123456" },
    shipping: { region: "yerevan", city: "Yerevan", line1: "Abovyan 10" },
    paymentMethod: "cod",
    ageConfirmed: true,
    termsAccepted: true,
    locale: "en",
    ...over,
  };
}

export async function placeOrder(c: TestClient, over: Partial<CheckoutRequest> = {}, key: string = randomUUID()): Promise<ApiResult<{ data: { order: { number: string; status: string; total: number }; payment: { redirect: { url: string } | null } } }>> {
  return c.call(ordersRoute, "POST", "/api/v1/orders", { body: checkoutPayload(over), headers: { "idempotency-key": key } });
}

export const STRONG_PASSWORD = "Correct-Horse-9-Battery";

export async function registeredUser(email = `u-${randomUUID().slice(0, 8)}@example.com`, password = STRONG_PASSWORD): Promise<{ client: TestClient; email: string; password: string }> {
  const c = await shopper();
  const reg = await c.call(registerRoute, "POST", "/api/v1/auth/register", { body: { email, password, name: "Test User", locale: "en" } });
  expect(reg.status).toBe(202);
  const login = await c.call(loginRoute, "POST", "/api/v1/auth/login", { body: { email, password } });
  expect(login.status).toBe(200);
  return { client: c, email, password };
}

/** Creates an admin with an enrolled TOTP secret and returns an MFA-verified client. */
export async function adminClient(): Promise<{ client: TestClient; secret: string; email: string; password: string }> {
  const { User } = await import("@/server/models");
  const { hashPassword } = await import("@/server/auth/passwords");
  const { encryptSecret } = await import("@/server/auth/mfa");
  const email = `admin-${randomUUID().slice(0, 8)}@example.com`;
  const password = STRONG_PASSWORD;
  const secret = generateSecret();
  await User.create({ email, name: "Admin", passwordHash: await hashPassword(password), role: "admin", mfa: { enabled: true, secretEnc: encryptSecret(secret), enabledAt: new Date() } });
  const c = new TestClient();
  await c.call(csrfRoute, "GET", "/api/v1/auth/csrf");
  const login = await c.call<{ data: { mfa: string } }>(loginRoute, "POST", "/api/v1/auth/login", { body: { email, password } });
  expect(login.body.data.mfa).toBe("verify");
  const verify = await c.call(mfaVerifyRoute, "POST", "/api/v1/auth/mfa/verify", { body: { code: generateSync({ secret }) } });
  expect(verify.status).toBe(200);
  return { client: c, secret, email, password };
}

export function signMock(raw: string): string {
  // Mirrors the server's HMAC (MOCK_PAYMENT_SECRET=test-mock-secret in integration-setup).
  return createHmac("sha256", "test-mock-secret").update(raw).digest("base64url");
}
