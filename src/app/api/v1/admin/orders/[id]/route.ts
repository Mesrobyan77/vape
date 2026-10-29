import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { getAdminOrder } from "@/server/services/admin";

export const dynamic = "force-dynamic";

export const GET = handler<{ id: string }>({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  data: await getAdminOrder(parseParams(idParam, ctx.params).id),
}));
