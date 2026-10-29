import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { connectDb } from "@/server/db";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { Order } from "@/server/models";
import { applyVerifiedPayment, recordRejectedCallback } from "@/server/payments/apply";
import { idramAmount, idramChecksum, parseIdramAmount, verifyIdramChecksum } from "@/server/payments/idram";
import { safeEqual } from "@/server/crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const text = (body: string, status = 200) => new NextResponse(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/**
 * Idram RESULT_URL (server-to-server). Two request kinds per the merchant interface document:
 * a precheck (EDP_PRECHECK=YES) answered with "OK" only when the bill is valid and payable,
 * and the payment confirmation verified with EDP_CHECKSUM before any state change.
 */
export const POST = handler({ csrf: false, rawBody: true, rateLimit: [{ rule: LIMITS.callbacks }] }, async (ctx) => {
  const cfg = config();
  if (cfg.paymentMode !== "live" || !cfg.idram) return text("NOT_FOUND", 404);
  const raw = await ctx.req.text();
  if (raw.length > 4096) return text("TOO_LARGE", 413);
  const f = new URLSearchParams(raw);
  const billNo = f.get("EDP_BILL_NO") ?? "";
  const recAccount = f.get("EDP_REC_ACCOUNT") ?? "";
  const amountRaw = f.get("EDP_AMOUNT") ?? "";
  if (!safeEqual(recAccount, cfg.idram.recAccount)) {
    await recordRejectedCallback("idram", "merchant_mismatch", { orderNumber: billNo });
    return text("ERROR", 400);
  }
  const amount = parseIdramAmount(amountRaw);
  await connectDb();

  if (f.get("EDP_PRECHECK") === "YES") {
    const order = await Order.findOne({ number: billNo, paymentMethod: "idram" }).lean();
    const payable =
      order &&
      amount !== null &&
      amount === order.totals.total &&
      (order.status === "awaiting_payment" || order.status === "payment_failed") &&
      (!order.reservationExpiresAt || order.reservationExpiresAt > new Date());
    return payable ? text("OK") : text("NOT OK");
  }

  const transId = f.get("EDP_TRANS_ID") ?? "";
  const expected = idramChecksum({
    recAccount,
    amount: amountRaw,
    secretKey: cfg.idram.secretKey,
    billNo,
    payerAccount: f.get("EDP_PAYER_ACCOUNT") ?? "",
    transId,
    transDate: f.get("EDP_TRANS_DATE") ?? "",
  });
  const received = f.get("EDP_CHECKSUM") ?? "";
  if (!received || !verifyIdramChecksum(received, expected) || amount === null || !/^[A-Za-z0-9]{1,32}$/.test(transId)) {
    await recordRejectedCallback("idram", "invalid_checksum", { orderNumber: billNo });
    return text("ERROR", 400);
  }
  const outcome = await applyVerifiedPayment("idram", {
    eventKey: `idram:${transId}`,
    orderNumber: billNo,
    providerRef: transId,
    amount,
    currency: "AMD",
    outcome: "succeeded",
    summary: { orderNumber: billNo, transId, amount: idramAmount(amount) },
  });
  return outcome.result === "rejected" ? text("ERROR", 400) : text("OK");
});
