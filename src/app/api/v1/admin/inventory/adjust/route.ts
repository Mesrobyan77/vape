import { adminActorOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { adjustInventory } from "@/server/services/admin";
import { inventoryAdjustInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

/** Relative, atomic adjustment (never overwrites stock with a possibly stale absolute value). */
export const POST = handler({ auth: "admin", body: inventoryAdjustInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  data: await adjustInventory(ctx.body, adminActorOf(ctx)),
}));
