import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { listMovements } from "@/server/services/admin";
import { pageQuery } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const GET = handler({ auth: "admin", query: pageQuery, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => {
  const { items, meta } = await listMovements(ctx.query);
  return { data: items, meta };
});
