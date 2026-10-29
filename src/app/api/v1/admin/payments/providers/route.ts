import { handler } from "@/server/http/handler";
import { providerStatuses } from "@/server/services/admin";

export const dynamic = "force-dynamic";

/** Configuration status only — never secrets. */
export const GET = handler({ auth: "admin" }, async () => ({ data: providerStatuses() }));
