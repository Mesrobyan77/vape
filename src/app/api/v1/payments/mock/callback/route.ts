import { NextResponse } from "next/server";
import { connectDb } from "@/server/db";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { recordRejectedCallback } from "@/server/payments/apply";
import { mockAllowed, verifyMockSignature } from "@/server/payments/mock";
import { applyMockCallback, mockCallbackSchema } from "@/server/payments/mock-flow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Non-production simulated provider webhook. HMAC over the exact raw body (X-Mock-Signature). */
export const POST = handler({ csrf: false, rawBody: true, rateLimit: [{ rule: LIMITS.callbacks }] }, async (ctx) => {
  if (!mockAllowed()) return new NextResponse("Not found", { status: 404 });
  const raw = await ctx.req.text();
  if (raw.length > 4096) return NextResponse.json({ ok: false }, { status: 413 });
  await connectDb();
  if (!verifyMockSignature(raw, ctx.req.headers.get("x-mock-signature"))) {
    await recordRejectedCallback("mock", "invalid_signature", {});
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "malformed" }, { status: 400 });
  }
  const parsed = mockCallbackSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "malformed" }, { status: 400 });
  const outcome = await applyMockCallback(parsed.data);
  const status = outcome.result === "rejected" ? 422 : 200;
  return NextResponse.json({ ok: outcome.result !== "rejected", ...outcome }, { status });
});
