import { z } from "zod";
import { verifySecondFactor } from "@/server/auth/mfa";
import { adminActorOf } from "@/server/http/common";
import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { adminResetMfa } from "@/server/services/admin";

export const dynamic = "force-dynamic";

const body = z.object({ code: z.string().trim().regex(/^\d{6}$/), confirm: z.literal(true) }).strict();

/** Step-up protected: the acting admin must supply a fresh TOTP code. */
export const POST = handler<{ id: string }, typeof body>({ auth: "admin", body, rateLimit: [{ rule: LIMITS.mfa }] }, async (ctx) => {
  await verifySecondFactor(ctx.user!, { code: ctx.body.code });
  await adminResetMfa(parseParams(idParam, ctx.params).id, adminActorOf(ctx));
  return { status: 204 };
});
