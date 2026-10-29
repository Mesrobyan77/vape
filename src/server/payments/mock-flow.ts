import { z } from "zod";
import { applyVerifiedPayment, recordRejectedCallback, type ApplyOutcome } from "./apply";

/** Payload a (simulated) provider sends to /payments/mock/callback. Signed over the raw body. */
export const mockCallbackSchema = z
  .object({
    eventId: z.string().regex(/^[A-Za-z0-9:_-]{4,100}$/),
    orderNumber: z.string().max(40),
    amount: z.number().int().min(0),
    currency: z.string().max(8),
    outcome: z.enum(["succeeded", "failed", "pending"]),
  })
  .strict();

export type MockCallback = z.output<typeof mockCallbackSchema>;

export async function applyMockCallback(payload: MockCallback): Promise<ApplyOutcome> {
  if (payload.currency !== "AMD") {
    await recordRejectedCallback("mock", "currency_mismatch", { orderNumber: payload.orderNumber });
    return { result: "rejected", reason: "currency_mismatch" };
  }
  return applyVerifiedPayment("mock", {
    eventKey: `mock:${payload.eventId}`,
    orderNumber: payload.orderNumber,
    providerRef: null,
    amount: payload.amount,
    currency: "AMD",
    outcome: payload.outcome,
    summary: { orderNumber: payload.orderNumber, outcome: payload.outcome, amount: payload.amount },
  });
}
