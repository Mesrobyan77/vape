import type { PaymentMethod, PaymentRedirect } from "@/lib/api/types";

export interface InitiateInput {
  paymentId: string;
  orderNumber: string;
  amount: number;
  locale: "hy" | "ru" | "en";
  description: string;
  customerEmail: string;
}

export interface InitiateResult {
  redirect: PaymentRedirect | null;
  providerRef: string | null;
}

/** Normalized, verified provider outcome. */
export interface VerifiedPaymentEvent {
  eventKey: string;
  orderNumber: string;
  providerRef: string | null;
  amount: number;
  currency: "AMD";
  outcome: "succeeded" | "failed" | "pending";
  summary: Record<string, string | number | boolean | null>;
}

export interface PaymentProvider {
  method: PaymentMethod;
  /** Online providers hold an active reservation until confirmation. */
  online: boolean;
  isEnabled(): boolean;
  initiate(input: InitiateInput): Promise<InitiateResult>;
}
