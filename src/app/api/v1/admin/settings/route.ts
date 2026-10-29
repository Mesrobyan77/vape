import { adminActorOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { getAdminSettings, updateSettings } from "@/server/services/admin";
import { settingsInput } from "@/server/services/admin-schemas";

export const dynamic = "force-dynamic";

export const GET = handler({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async () => ({ data: await getAdminSettings() }));

export const PUT = handler({ auth: "admin", body: settingsInput, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => ({
  data: await updateSettings(ctx.body, adminActorOf(ctx)),
}));
