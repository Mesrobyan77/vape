import { z } from "zod";
import { passwordSchema } from "@/server/auth/passwords";
import { resetPassword } from "@/server/auth/service";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";

export const dynamic = "force-dynamic";

const body = z.object({ token: z.string().min(20).max(200), password: passwordSchema }).strict();

export const POST = handler({ body, rateLimit: [{ rule: LIMITS.resetPassword }] }, async (ctx) => {
  await resetPassword(ctx.body.token, ctx.body.password);
  await ctx.endSession();
  return { status: 204 };
});
