import { z } from "zod";
import { handler } from "@/server/http/handler";
import { pageMeta } from "@/server/services/dto";
import { listUserOrders } from "@/server/services/orders";

export const dynamic = "force-dynamic";

const query = z
  .object({ page: z.coerce.number().int().min(1).max(1000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(10) })
  .passthrough();

export const GET = handler({ auth: "user", query }, async (ctx) => {
  const { items, total } = await listUserOrders(ctx.user!._id, ctx.query.page, ctx.query.pageSize);
  return { data: items, meta: pageMeta(ctx.query.page, ctx.query.pageSize, total) };
});
