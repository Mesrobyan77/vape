import { z } from "zod";
import { verifySecondFactor } from "@/server/auth/mfa";
import { handler } from "@/server/http/handler";
import { requireAdminUser } from "@/server/http/mfa-guard";
import { LIMITS } from "@/server/http/rate-limit";
import { audit } from "@/server/services/audit";

export const dynamic = "force-dynamic";

const body = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/).optional(),
    recoveryCode: z.string().trim().min(8).max(20).optional(),
  })
  .strict()
  .refine((b) => Boolean(b.code) !== Boolean(b.recoveryCode), { message: "Provide either code or recoveryCode", path: ["code"] });

export const POST = handler({ auth: "user", body, rateLimit: [{ rule: LIMITS.mfa }] }, async (ctx) => {
  const user = requireAdminUser(ctx);
  let method: "totp" | "recovery";
  try {
    method = await verifySecondFactor(user, ctx.body);
  } catch (err) {
    await audit({ actorId: user._id, actorEmail: user.email, action: "mfa.verify_failed", targetType: "user", targetId: String(user._id), requestId: ctx.requestId, ip: ctx.ip });
    throw err;
  }
  const { csrfToken } = await ctx.rotateSession({ userId: user._id, role: user.role, mfaVerified: true });
  await audit({ actorId: user._id, actorEmail: user.email, action: `mfa.verified_${method}`, targetType: "user", targetId: String(user._id), requestId: ctx.requestId, ip: ctx.ip });
  return { data: { csrfToken } };
});
