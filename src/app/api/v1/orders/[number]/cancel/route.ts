import { localeOf, viewerOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { CUSTOMER_CANCELLABLE } from "@/server/domain/state";
import { cancelOrder, findOrderForViewer, orderDetail } from "@/server/services/orders";

export const dynamic = "force-dynamic";

export const POST = handler<{ number: string }>({}, async (ctx) => {
  const order = await findOrderForViewer(String(ctx.params.number), viewerOf(ctx));
  const updated = await cancelOrder(
    order._id,
    { id: ctx.user?._id ?? null, email: ctx.user?.email ?? null, kind: "customer", requestId: ctx.requestId, ip: ctx.ip },
    "cancelled by customer",
    CUSTOMER_CANCELLABLE,
  );
  return { data: orderDetail(updated, localeOf(ctx)) };
});
