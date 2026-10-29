import { localeOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { publicSettings } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export const GET = handler({ cache: "public" }, async (ctx) => ({ data: await publicSettings(localeOf(ctx)) }));
