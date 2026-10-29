import { z } from "zod";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { submitContact } from "@/server/services/content";

export const dynamic = "force-dynamic";

const body = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().max(254).email(),
    phone: z.string().trim().max(24).regex(/^[+\d\s()-]*$/, "Invalid phone").optional(),
    subject: z.string().trim().min(2).max(120),
    message: z.string().trim().min(10).max(4000),
    locale: z.enum(["hy", "ru", "en"]).default("hy"),
    website: z.string().max(200).optional(), // honeypot: must stay empty
  })
  .strict();

export const POST = handler({ body, rateLimit: [{ rule: LIMITS.contact }] }, async (ctx) => {
  const { website, ...input } = ctx.body;
  if (website) return { status: 201, data: { id: null } }; // silently drop bots
  const id = await submitContact({ ...input, email: input.email.toLowerCase() });
  return { status: 201, data: { id } };
});
