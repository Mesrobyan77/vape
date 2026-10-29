import { adminActorOf } from "@/server/http/common";
import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { deleteBlogPost, saveBlogPost } from "@/server/services/admin";
import { blogInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const PATCH = handler<{ id: string }, typeof blogInput>({ auth: "admin", body: blogInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  data: await saveBlogPost(parseParams(idParam, ctx.params).id, ctx.body, adminActorOf(ctx)),
}));

export const DELETE = handler<{ id: string }>({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => {
  await deleteBlogPost(parseParams(idParam, ctx.params).id, adminActorOf(ctx));
  return { status: 204 };
});
