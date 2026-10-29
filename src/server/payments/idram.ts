import { createHash } from "node:crypto";
import { config } from "../config";
import { safeEqual } from "../crypto";
import type { InitiateInput, InitiateResult, PaymentProvider } from "./types";

/**
 * Idram merchant integration.
 * Source: "Idram Payment System merchant interface description" (Idram merchant API document) —
 * see docs/payment-integrations.md. Summary of the documented protocol:
 *  - The shop posts an HTML form to Idram with EDP_LANGUAGE, EDP_REC_ACCOUNT, EDP_DESCRIPTION,
 *    EDP_AMOUNT, EDP_BILL_NO (+ optional EDP_EMAIL).
 *  - Idram calls RESULT_URL twice: (a) precheck with EDP_PRECHECK=YES, EDP_BILL_NO,
 *    EDP_REC_ACCOUNT, EDP_AMOUNT — the shop must answer plain "OK" to allow payment;
 *    (b) confirmation with EDP_BILL_NO, EDP_REC_ACCOUNT, EDP_PAYER_ACCOUNT, EDP_AMOUNT,
 *    EDP_TRANS_ID, EDP_TRANS_DATE, EDP_CHECKSUM.
 *  - EDP_CHECKSUM = MD5("EDP_REC_ACCOUNT:EDP_AMOUNT:SECRET_KEY:EDP_BILL_NO:EDP_PAYER_ACCOUNT:EDP_TRANS_ID:EDP_TRANS_DATE"),
 *    compared case-insensitively.
 * The form host must be confirmed with Idram during onboarding (the document shows both
 * web.idram.am and money.idram.am); it is configurable via IDRAM_FORM_URL.
 */
export const IDRAM_DEFAULT_FORM_URL = "https://web.idram.am/payment.aspx";

const LANG: Record<InitiateInput["locale"], string> = { hy: "AM", ru: "RU", en: "EN" };

export function idramAmount(amount: number): string {
  return amount.toFixed(2);
}

export function idramChecksum(fields: {
  recAccount: string;
  amount: string;
  secretKey: string;
  billNo: string;
  payerAccount: string;
  transId: string;
  transDate: string;
}): string {
  const raw = [fields.recAccount, fields.amount, fields.secretKey, fields.billNo, fields.payerAccount, fields.transId, fields.transDate].join(":");
  return createHash("md5").update(raw, "utf8").digest("hex").toUpperCase();
}

export function verifyIdramChecksum(received: string, expected: string): boolean {
  return safeEqual(received.trim().toUpperCase(), expected.toUpperCase());
}

/** Parses a decimal amount string from Idram into whole dram; rejects fractional dram. */
export function parseIdramAmount(value: string): number | null {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

export const idramProvider: PaymentProvider = {
  method: "idram",
  online: true,
  isEnabled: () => config().paymentMode === "live" && config().idram !== null,
  async initiate(input): Promise<InitiateResult> {
    const cfg = config().idram;
    if (!cfg) throw new Error("idram not configured");
    return {
      providerRef: null,
      redirect: {
        url: process.env.IDRAM_FORM_URL || IDRAM_DEFAULT_FORM_URL,
        method: "POST",
        fields: {
          EDP_LANGUAGE: LANG[input.locale],
          EDP_REC_ACCOUNT: cfg.recAccount,
          EDP_DESCRIPTION: input.description.slice(0, 120),
          EDP_AMOUNT: idramAmount(input.amount),
          EDP_BILL_NO: input.orderNumber,
          EDP_EMAIL: input.customerEmail,
        },
      },
    };
  },
};
