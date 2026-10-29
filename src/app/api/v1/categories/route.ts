import { localeOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { listCategories } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export const GET = handler({ cache: "public" }, async (ctx) => ({ data: await listCategories(localeOf(ctx)) }));
