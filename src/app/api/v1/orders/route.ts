import { z } from "zod";
import { REGION_CODES } from "@/lib/pricing";
import { AppError } from "@/server/errors";
import { viewerOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { checkout, saveAddressFromCheckout } from "@/server/services/orders";

export const dynamic = "force-dynamic";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const checkoutBody = z
  .object({
    customer: z
      .object({
        firstName: text(1, 60),
        lastName: text(1, 60),
        email: z.string().trim().max(254).email(),
        phone: z.string().trim().min(6).max(24).regex(/^[+\d\s()-]+$/, "Invalid phone"),
      })
      .strict(),
    shipping: z
      .object({
        region: z.enum(REGION_CODES),
        city: text(1, 80),
        line1: text(3, 200),
        line2: z.string().trim().max(200).optional(),
        notes: z.string().trim().max(500).optional(),
      })
      .strict(),
    paymentMethod: z.enum(["cod", "idram", "arca", "mock"]),
    couponCode: z.string().trim().max(40).optional(),
    ageConfirmed: z.literal(true),
    termsAccepted: z.literal(true),
    locale: z.enum(["hy", "ru", "en"]),
    saveAddress: z.boolean().optional(),
  })
  .strict();

const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{16,64}$/;

export const POST = handler({ body: checkoutBody, rateLimit: [{ rule: LIMITS.checkout }] }, async (ctx) => {
  const key = ctx.req.headers.get("idempotency-key") ?? "";
  if (!IDEMPOTENCY_KEY.test(key)) {
    throw new AppError("VALIDATION_FAILED", "A valid Idempotency-Key header is required.", [{ path: "Idempotency-Key", message: "required" }]);
  }
  if (!ctx.session) throw new AppError("CSRF_INVALID");
  const { response, replayed } = await checkout(ctx.body, {
    viewer: viewerOf(ctx),
    idempotencyKey: key,
    ageConfirmedAt: ctx.session.ageConfirmedAt,
  });
  if (!replayed && ctx.body.saveAddress && ctx.user) await saveAddressFromCheckout(ctx.user._id, ctx.body).catch(() => undefined);
  return { status: replayed ? 200 : 201, data: response };
});
