import { adminActorOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { createProduct, listAdminProducts } from "@/server/services/admin";
import { pageQuery, productCreateInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const GET = handler({ auth: "admin", query: pageQuery, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => {
  const { items, meta } = await listAdminProducts(ctx.query);
  return { data: items, meta };
});

export const POST = handler({ auth: "admin", body: productCreateInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  status: 201,
  data: await createProduct(ctx.body, adminActorOf(ctx)),
}));
