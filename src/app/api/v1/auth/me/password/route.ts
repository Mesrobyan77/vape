import { z } from "zod";
import { passwordSchema } from "@/server/auth/passwords";
import { changePassword } from "@/server/auth/service";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";

export const dynamic = "force-dynamic";

const body = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema }).strict();

export const PATCH = handler({ auth: "user", body, rateLimit: [{ rule: LIMITS.resetPassword }] }, async (ctx) => {
  const user = ctx.user!;
  await changePassword(user, ctx.body.currentPassword, ctx.body.newPassword, null);
  // Revokes every session (including this one), then issues a fresh id for this browser.
  const { csrfToken } = await ctx.rotateSession({ userId: user._id, role: user.role, mfaVerified: ctx.session?.mfaVerified ?? false });
  return { data: { csrfToken } };
});
