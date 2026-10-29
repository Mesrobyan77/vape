import { handler } from "@/server/http/handler";
import { listBrands } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export const GET = handler({ cache: "public" }, async () => ({ data: await listBrands() }));
