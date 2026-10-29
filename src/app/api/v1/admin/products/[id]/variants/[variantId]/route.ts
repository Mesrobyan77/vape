import { z } from "zod";
import { adminActorOf } from "@/server/http/common";
import { handler, objectId, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { deactivateVariant, updateVariant } from "@/server/services/admin";
import { variantUpdateInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

const params = z.object({ id: objectId, variantId: objectId });

export const PATCH = handler<{ id: string; variantId: string }, typeof variantUpdateInput>(
  { auth: "admin", body: variantUpdateInput, rateLimit: [{ rule: LIMITS.admin }] },
  async (ctx) => {
    const p = parseParams(params, ctx.params);
    return { data: await updateVariant(p.id, p.variantId, ctx.body, adminActorOf(ctx)) };
  },
);

/** Variants are deactivated, never removed — historical orders reference them. */
export const DELETE = handler<{ id: string; variantId: string }>({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => {
  const p = parseParams(params, ctx.params);
  return { data: await deactivateVariant(p.id, p.variantId, adminActorOf(ctx)) };
});
