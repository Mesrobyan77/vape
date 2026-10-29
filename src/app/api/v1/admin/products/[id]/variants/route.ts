import { adminActorOf } from "@/server/http/common";
import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { addVariant } from "@/server/services/admin";
import { variantInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const POST = handler<{ id: string }, typeof variantInput>({ auth: "admin", body: variantInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  status: 201,
  data: await addVariant(parseParams(idParam, ctx.params).id, ctx.body, adminActorOf(ctx)),
}));
