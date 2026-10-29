import { adminActorOf } from "@/server/http/common";
import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { setUserActive } from "@/server/services/admin";
import { userUpdateInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const PATCH = handler<{ id: string }, typeof userUpdateInput>({ auth: "admin", body: userUpdateInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => {
  await setUserActive(parseParams(idParam, ctx.params).id, ctx.body.active, adminActorOf(ctx));
  return { status: 204 };
});
