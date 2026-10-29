import { localeOf, viewerOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { findOrderForViewer, orderDetail } from "@/server/services/orders";

export const dynamic = "force-dynamic";

export const GET = handler<{ number: string }>({}, async (ctx) => {
  const order = await findOrderForViewer(String(ctx.params.number), viewerOf(ctx));
  return { data: orderDetail(order, localeOf(ctx)) };
});
