import { z } from "zod";
import { emailSchema, passwordSchema } from "@/server/auth/passwords";
import { register } from "@/server/auth/service";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";

export const dynamic = "force-dynamic";

const body = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().trim().min(1).max(80),
    locale: z.enum(["hy", "ru", "en"]).default("hy"),
  })
  .strict(); // unknown fields such as "role" are rejected (mass-assignment protection)

export const POST = handler({ body, rateLimit: [{ rule: LIMITS.register }] }, async (ctx) => {
  await register(ctx.body);
  return { status: 202, data: { status: "accepted" } };
});
