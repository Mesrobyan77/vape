import { NextResponse } from "next/server";
import { formatAmd } from "@/lib/money";
import { connectDb } from "@/server/db";
import { handler, objectId, parseParams } from "@/server/http/handler";
import { Order, PaymentTransaction } from "@/server/models";
import { mockAllowed } from "@/server/payments/mock";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** Simulated hosted payment page (development/test only). */
export const GET = handler<{ paymentId: string }>({}, async (ctx) => {
  if (!mockAllowed()) return new NextResponse("Not found", { status: 404 });
  const { paymentId } = parseParams(z.object({ paymentId: objectId }), ctx.params);
  await connectDb();
  const payment = await PaymentTransaction.findOne({ _id: paymentId, provider: "mock" }).lean();
  const order = payment ? await Order.findById(payment.orderId).lean() : null;
  if (!payment || !order) return new NextResponse("Not found", { status: 404 });
  const button = (outcome: string, label: string, color: string) =>
    `<form method="post" action="/api/v1/payments/mock/action"><input type="hidden" name="paymentId" value="${esc(String(payment._id))}"><input type="hidden" name="outcome" value="${outcome}"><button type="submit" style="width:100%;padding:14px;margin:6px 0;border:0;background:${color};color:#fff;font-weight:700;cursor:pointer">${label}</button></form>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mock payment provider</title></head>
<body style="margin:0;font-family:Arial,sans-serif;background:#0c0c0d;color:#fafafa;display:grid;place-items:center;min-height:100vh">
<main style="width:min(420px,92vw);background:#141516;padding:24px;border-radius:10px">
<p style="margin:0 0 8px;color:#caacf0;font-size:12px;letter-spacing:2px">TEST MODE — NO REAL MONEY</p>
<h1 style="margin:0 0 16px;font-size:22px">Mock payment provider</h1>
<p>Order <strong>${esc(order.number)}</strong></p>
<p>Amount <strong>${esc(formatAmd(payment.amount))}</strong></p>
${button("succeeded", "Pay (simulate success)", "#2e8b57")}
${button("failed", "Decline (simulate failure)", "#b4373b")}
${button("pending", "Leave pending", "#45474f")}
</main></body></html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
});
