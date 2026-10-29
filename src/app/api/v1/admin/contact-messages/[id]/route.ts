import { adminActorOf } from "@/server/http/common";
import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { setContactStatus } from "@/server/services/admin";
import { contactStatusInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const PATCH = handler<{ id: string }, typeof contactStatusInput>({ auth: "admin", body: contactStatusInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => {
  await setContactStatus(parseParams(idParam, ctx.params).id, ctx.body.status, adminActorOf(ctx));
  return { status: 204 };
});
