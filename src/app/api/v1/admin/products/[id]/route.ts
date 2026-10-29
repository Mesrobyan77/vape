import { adminActorOf } from "@/server/http/common";
import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { deleteProduct, getAdminProduct, updateProduct } from "@/server/services/admin";
import { productUpdateInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const GET = handler<{ id: string }>({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  data: await getAdminProduct(parseParams(idParam, ctx.params).id),
}));

export const PATCH = handler<{ id: string }, typeof productUpdateInput>({ auth: "admin", body: productUpdateInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  data: await updateProduct(parseParams(idParam, ctx.params).id, ctx.body, adminActorOf(ctx)),
}));

export const DELETE = handler<{ id: string }>({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => {
  await deleteProduct(parseParams(idParam, ctx.params).id, adminActorOf(ctx));
  return { status: 204 };
});
