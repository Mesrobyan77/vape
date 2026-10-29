import { z } from "zod";
import { emailSchema } from "@/server/auth/passwords";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { subscribeNewsletter } from "@/server/services/content";

export const dynamic = "force-dynamic";

const body = z.object({ email: emailSchema, locale: z.enum(["hy", "ru", "en"]).default("hy") }).strict();

/** Identical 202 for new and repeated subscriptions. */
export const POST = handler({ body, rateLimit: [{ rule: LIMITS.newsletter }] }, async (ctx) => {
  await subscribeNewsletter(ctx.body.email, ctx.body.locale);
  return { status: 202, data: { status: "accepted" } };
});
