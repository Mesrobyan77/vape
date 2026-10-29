import { adminActorOf } from "@/server/http/common";
import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { deleteCategory, saveCategory } from "@/server/services/admin";
import { categoryInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const PATCH = handler<{ id: string }, typeof categoryInput>({ auth: "admin", body: categoryInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  data: await saveCategory(parseParams(idParam, ctx.params).id, ctx.body, adminActorOf(ctx)),
}));

export const DELETE = handler<{ id: string }>({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => {
  await deleteCategory(parseParams(idParam, ctx.params).id, adminActorOf(ctx));
  return { status: 204 };
});
