import { z } from "zod";
import { activateEnrollment } from "@/server/auth/mfa";
import { handler } from "@/server/http/handler";
import { requireAdminUser } from "@/server/http/mfa-guard";
import { LIMITS } from "@/server/http/rate-limit";
import { audit } from "@/server/services/audit";

export const dynamic = "force-dynamic";

const body = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).strict();

export const POST = handler({ auth: "user", body, rateLimit: [{ rule: LIMITS.mfa }] }, async (ctx) => {
  const user = requireAdminUser(ctx);
  const recoveryCodes = await activateEnrollment(user, ctx.body.code);
  // Enrolment proves possession of the factor: rotate into an MFA-verified session.
  const { csrfToken } = await ctx.rotateSession({ userId: user._id, role: user.role, mfaVerified: true });
  await audit({ actorId: user._id, actorEmail: user.email, action: "mfa.enabled", targetType: "user", targetId: String(user._id), requestId: ctx.requestId, ip: ctx.ip });
  return { data: { recoveryCodes, csrfToken } };
});
