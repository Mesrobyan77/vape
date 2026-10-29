import { adminActorOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { listCoupons, saveCoupon } from "@/server/services/admin";
import { couponInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const GET = handler({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async () => ({ data: await listCoupons() }));

export const POST = handler({ auth: "admin", body: couponInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  status: 201,
  data: await saveCoupon(null, ctx.body, adminActorOf(ctx)),
}));
