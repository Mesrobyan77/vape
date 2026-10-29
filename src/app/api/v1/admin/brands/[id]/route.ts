import { adminActorOf } from "@/server/http/common";
import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { deleteBrand, saveBrand } from "@/server/services/admin";
import { brandInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const PATCH = handler<{ id: string }, typeof brandInput>({ auth: "admin", body: brandInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  data: await saveBrand(parseParams(idParam, ctx.params).id, ctx.body, adminActorOf(ctx)),
}));

export const DELETE = handler<{ id: string }>({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => {
  await deleteBrand(parseParams(idParam, ctx.params).id, adminActorOf(ctx));
  return { status: 204 };
});
