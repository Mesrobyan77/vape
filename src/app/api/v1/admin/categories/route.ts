import { adminActorOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { listAdminCategories, saveCategory } from "@/server/services/admin";
import { categoryInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const GET = handler({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async () => ({ data: await listAdminCategories() }));

export const POST = handler({ auth: "admin", body: categoryInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  status: 201,
  data: await saveCategory(null, ctx.body, adminActorOf(ctx)),
}));
