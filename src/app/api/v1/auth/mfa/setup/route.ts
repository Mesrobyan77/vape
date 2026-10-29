import { startEnrollment } from "@/server/auth/mfa";
import { handler } from "@/server/http/handler";
import { requireAdminUser } from "@/server/http/mfa-guard";
import { LIMITS } from "@/server/http/rate-limit";
import { audit } from "@/server/services/audit";

export const dynamic = "force-dynamic";

export const POST = handler({ auth: "user", rateLimit: [{ rule: LIMITS.mfa }] }, async (ctx) => {
  const user = requireAdminUser(ctx);
  const data = await startEnrollment(user);
  await audit({ actorId: user._id, actorEmail: user.email, action: "mfa.enroll_start", targetType: "user", targetId: String(user._id), requestId: ctx.requestId, ip: ctx.ip });
  return { data };
});
