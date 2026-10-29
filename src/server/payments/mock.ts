import { config } from "../config";
import { hmacSha256, safeEqual } from "../crypto";
import type { InitiateResult, PaymentProvider } from "./types";

/**
 * Development/test-only simulated provider. Never available in production
 * (config validation refuses PAYMENT_MODE=mock and the routes check isProduction).
 * Callbacks are HMAC-signed over the raw body with MOCK_PAYMENT_SECRET.
 */
export const mockAllowed = () => !config().isProduction && config().paymentMode === "mock";

export function signMockPayload(rawBody: string): string {
  return hmacSha256(config().mockPaymentSecret, rawBody);
}

export function verifyMockSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  return safeEqual(signature, signMockPayload(rawBody));
}

export const mockProvider: PaymentProvider = {
  method: "mock",
  online: true,
  isEnabled: mockAllowed,
  async initiate(input): Promise<InitiateResult> {
    return {
      providerRef: `MOCK-${input.paymentId}`,
      redirect: { url: `${config().siteUrl}/api/v1/payments/mock/checkout/${input.paymentId}?locale=${input.locale}`, method: "GET", fields: {} },
    };
  },
};
