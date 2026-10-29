import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { dashboard } from "@/server/services/admin";

export const dynamic = "force-dynamic";

export const GET = handler({ auth: "admin", rateLimit: [{ rule: LIMITS.admin }] }, async () => ({ data: await dashboard() }));
