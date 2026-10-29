import { NextResponse, type NextRequest } from "next/server";
import { generateSecret, generateSync } from "otplib";
import { z } from "zod";
import { config } from "@/server/config";
import { safeEqual } from "@/server/crypto";
import { connectDb } from "@/server/db";
import { errorResponse } from "@/server/http/handler";
import { resetMemoryRateLimits } from "@/server/http/rate-limit";
import { runJobsOnce } from "@/server/jobs";
import { CapturedEmail, Order, Product, User } from "@/server/models";
import { encryptSecret } from "@/server/auth/mfa";
import { hashPassword, normalizeEmail } from "@/server/auth/passwords";
import { resetDatabase, seedDatabase } from "@/server/seed";
import { expireReservations } from "@/server/services/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Deterministic E2E support. Mounted only when NODE_ENV !== "production" AND
 * E2E_TEST_API_TOKEN is configured (config validation also refuses the token in production).
 * Every call must present X-Test-Token.
 */
function allowed(req: NextRequest): boolean {
  const cfg = config();
  if (cfg.isProduction || !cfg.e2eTestToken) return false;
  return safeEqual(req.headers.get("x-test-token") ?? "", cfg.e2eTestToken);
}

const notFound = () => new NextResponse("Not found", { status: 404 });

async function readJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  return text ? (JSON.parse(text) as unknown) : {};
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  if (!allowed(req)) return notFound();
  const { action } = await params;
  try {
    await connectDb();
    if (action === "emails") {
      const to = req.nextUrl.searchParams.get("to");
      const filter = to ? { to: normalizeEmail(to) } : {};
      const emails = await CapturedEmail.find(filter).sort({ createdAt: -1 }).limit(50).lean();
      return NextResponse.json({ data: emails.map((e) => ({ to: e.to, subject: e.subject, text: e.text, template: e.template, createdAt: e.createdAt })) });
    }
    if (action === "order") {
      const number = req.nextUrl.searchParams.get("number") ?? "";
      const order = await Order.findOne({ number }).lean();
      return order ? NextResponse.json({ data: { status: order.status, paymentStatus: order.paymentStatus, reconciliation: order.reconciliation } }) : notFound();
    }
    return notFound();
  } catch (err) {
    return errorResponse(err, "test-support");
  }
}

const stockBody = z.object({ sku: z.string().min(1).max(64), stock: z.number().int().min(0).max(100000) }).strict();
const adminBody = z.object({ email: z.string().email(), password: z.string().min(10), name: z.string().default("Test Admin") }).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  if (!allowed(req)) return notFound();
  const { action } = await params;
  try {
    await connectDb();
    switch (action) {
      case "reset": {
        await resetDatabase();
        resetMemoryRateLimits();
        return NextResponse.json({ data: { ok: true } });
      }
      case "seed": {
        resetMemoryRateLimits();
        return NextResponse.json({ data: await seedDatabase({ reset: true }) });
      }
      case "stock": {
        const body = stockBody.parse(await readJson(req));
        const res = await Product.updateOne({ "variants.sku": body.sku.toUpperCase() }, { $set: { "variants.$.stock": body.stock } });
        return res.matchedCount ? NextResponse.json({ data: { ok: true } }) : notFound();
      }
      case "run-jobs":
        return NextResponse.json({ data: await runJobsOnce() });
      case "expire-reservations": {
        const body = z.object({ orderNumber: z.string().optional() }).strict().parse(await readJson(req));
        const past = new Date(Date.now() - 60_000);
        await Order.updateMany(
          { status: { $in: ["awaiting_payment", "payment_failed"] }, ...(body.orderNumber ? { number: body.orderNumber } : {}) },
          { $set: { reservationExpiresAt: past } },
        );
        return NextResponse.json({ data: { expired: await expireReservations(new Date()) } });
      }
      case "admin": {
        const body = adminBody.parse(await readJson(req));
        const secret = generateSecret();
        const email = normalizeEmail(body.email);
        await User.deleteOne({ email });
        await User.create({
          email,
          name: body.name,
          passwordHash: await hashPassword(body.password),
          role: "admin",
          mfa: { enabled: true, secretEnc: encryptSecret(secret), enabledAt: new Date(), recoveryCodeHashes: [] },
        });
        return NextResponse.json({ data: { email, totpSecret: secret } });
      }
      case "admin-unenrolled": {
        const body = adminBody.parse(await readJson(req));
        const email = normalizeEmail(body.email);
        await User.deleteOne({ email });
        await User.create({ email, name: body.name, passwordHash: await hashPassword(body.password), role: "admin" });
        return NextResponse.json({ data: { email } });
      }
      case "totp": {
        const body = z.object({ secret: z.string().min(16).max(64) }).strict().parse(await readJson(req));
        return NextResponse.json({ data: { code: generateSync({ secret: body.secret }) } });
      }
      default:
        return notFound();
    }
  } catch (err) {
    return errorResponse(err, "test-support");
  }
}
