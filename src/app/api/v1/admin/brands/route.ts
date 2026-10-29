import { adminActorOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { listAdminBrands, saveBrand } from "@/server/services/admin";
import { brandInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const GET = handler({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async () => ({ data: await listAdminBrands() }));

export const POST = handler({ auth: "admin", body: brandInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  status: 201,
  data: await saveBrand(null, ctx.body, adminActorOf(ctx)),
}));
