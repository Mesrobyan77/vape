import { adminActorOf } from "@/server/http/common";
import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { archiveProduct } from "@/server/services/admin";

export const dynamic = "force-dynamic";

export const POST = handler<{ id: string }>({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  data: await archiveProduct(parseParams(idParam, ctx.params).id, adminActorOf(ctx)),
}));
