import { config } from "../config";
import type { InitiateResult, PaymentProvider } from "./types";

/**
 * ArCa vPOS (BPC iPay "/payment/rest/") adapter.
 *
 * VERIFICATION STATUS: the official ArCa merchant manual was NOT available while this was
 * written. Endpoint host names (ipay.arca.am / ipaytest.arca.am) and the "/payment/rest/"
 * base come from secondary sources (see docs/payment-integrations.md). The request/response
 * fields below follow the standard iPay REST interface (register.do → orderId + formUrl,
 * getOrderStatusExtended.do → orderStatus, amount in minor units, ISO 4217 numeric 051 for AMD)
 * and MUST be confirmed against the bank-issued manual before PAYMENT_MODE=live is enabled.
 * The adapter stays disabled unless ARCA_API_URL / ARCA_USERNAME / ARCA_PASSWORD are set.
 *
 * Trust model: the customer's return to our callback URL proves nothing. Payment success is
 * only established by a server-side getOrderStatusExtended.do call.
 */
const AMD_NUMERIC = "051";
const TIMEOUT_MS = 10_000;

async function post(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const cfg = config().arca;
  if (!cfg) throw new Error("arca not configured");
  const body = new URLSearchParams({ userName: cfg.username, password: cfg.password, ...params });
  const res = await fetch(`${cfg.apiUrl}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`arca http ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export interface ArcaStatus {
  orderNumber: string | null;
  amount: number | null;
  currency: string | null;
  /** iPay orderStatus: 2 = deposited (paid). 1 = approved/hold, 3/6 = reversed/declined. */
  orderStatus: number | null;
}

export async function arcaOrderStatus(orderId: string): Promise<ArcaStatus> {
  const r = await post("getOrderStatusExtended.do", { orderId });
  const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : null);
  return {
    orderNumber: typeof r.orderNumber === "string" ? r.orderNumber : null,
    amount: num(r.amount),
    currency: typeof r.currency === "string" ? r.currency : r.currency !== undefined ? String(r.currency) : null,
    orderStatus: num(r.orderStatus),
  };
}

export const ARCA_CURRENCY = AMD_NUMERIC;

export const arcaProvider: PaymentProvider = {
  method: "arca",
  online: true,
  isEnabled: () => config().paymentMode === "live" && config().arca !== null,
  async initiate(input): Promise<InitiateResult> {
    const site = config().siteUrl;
    const r = await post("register.do", {
      orderNumber: input.orderNumber,
      amount: String(input.amount * 100), // minor units
      currency: AMD_NUMERIC,
      returnUrl: `${site}/api/v1/payments/arca/callback`,
      description: input.description.slice(0, 99),
      language: input.locale === "hy" ? "hy" : input.locale,
    });
    const orderId = typeof r.orderId === "string" ? r.orderId : null;
    const formUrl = typeof r.formUrl === "string" ? r.formUrl : null;
    if (!orderId || !formUrl || !formUrl.startsWith("https://")) throw new Error("arca register failed");
    return { providerRef: orderId, redirect: { url: formUrl, method: "GET", fields: {} } };
  },
};
