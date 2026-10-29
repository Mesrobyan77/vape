import { z } from "zod";
import { requestPasswordReset } from "@/server/auth/service";
import { emailKey } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().max(254), locale: z.enum(["hy", "ru", "en"]).default("hy") }).strict();

/** Always 202 — never reveals whether the email has an account. */
export const POST = handler({ body, rateLimit: [{ rule: LIMITS.forgotPassword, key: emailKey }] }, async (ctx) => {
  if (z.string().email().safeParse(ctx.body.email).success) await requestPasswordReset(ctx.body.email, ctx.body.locale);
  return { status: 202, data: { status: "accepted" } };
});
