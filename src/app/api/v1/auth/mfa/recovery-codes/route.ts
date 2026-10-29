import { z } from "zod";
import { regenerateRecoveryCodes, verifySecondFactor } from "@/server/auth/mfa";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { audit } from "@/server/services/audit";

export const dynamic = "force-dynamic";

const body = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).strict();

/** Step-up: requires an MFA-verified admin session AND a fresh TOTP code. */
export const POST = handler({ auth: "admin", body, rateLimit: [{ rule: LIMITS.mfa }] }, async (ctx) => {
  const user = ctx.user!;
  await verifySecondFactor(user, { code: ctx.body.code });
  const recoveryCodes = await regenerateRecoveryCodes(user);
  await audit({ actorId: user._id, actorEmail: user.email, action: "mfa.recovery_regenerated", targetType: "user", targetId: String(user._id), requestId: ctx.requestId, ip: ctx.ip });
  return { data: { recoveryCodes } };
});
