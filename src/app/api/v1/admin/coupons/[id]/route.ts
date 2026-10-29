import { adminActorOf } from "@/server/http/common";
import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { deleteCoupon, saveCoupon } from "@/server/services/admin";
import { couponInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const PATCH = handler<{ id: string }, typeof couponInput>({ auth: "admin", body: couponInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  data: await saveCoupon(parseParams(idParam, ctx.params).id, ctx.body, adminActorOf(ctx)),
}));

export const DELETE = handler<{ id: string }>({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => {
  await deleteCoupon(parseParams(idParam, ctx.params).id, adminActorOf(ctx));
  return { status: 204 };
});
