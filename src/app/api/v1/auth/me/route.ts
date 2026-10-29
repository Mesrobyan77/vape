import { z } from "zod";
import { userDto } from "@/server/auth/service";
import { handler, mfaStateOf } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";

export const dynamic = "force-dynamic";

export const GET = handler({}, async (ctx) => ({
  data: {
    user: ctx.user ? userDto(ctx.user) : null,
    session: { mfa: mfaStateOf(ctx.session, ctx.user), ageConfirmed: Boolean(ctx.session?.ageConfirmedAt) },
  },
}));

const body = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    phone: z
      .string()
      .trim()
      .max(24)
      .regex(/^[+\d\s()-]*$/, "Invalid phone")
      .optional(),
    locale: z.enum(["hy", "ru", "en"]).optional(),
  })
  .strict();

export const PATCH = handler({ auth: "user", body, rateLimit: [{ rule: LIMITS.account }] }, async (ctx) => {
  const user = ctx.user!;
  if (ctx.body.name !== undefined) user.name = ctx.body.name;
  if (ctx.body.phone !== undefined) user.phone = ctx.body.phone;
  if (ctx.body.locale !== undefined) user.locale = ctx.body.locale;
  await user.save();
  return { data: { user: userDto(user) } };
});
