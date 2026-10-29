import { Types } from "mongoose";
import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { getAdminOrder } from "@/server/services/admin";
import { orderTransitionInput } from "@/server/services/admin-schemas";
import { adminTransition } from "@/server/services/orders";

export const dynamic = "force-dynamic";

export const POST = handler<{ id: string }, typeof orderTransitionInput>(
  { auth: "admin", body: orderTransitionInput, rateLimit: [{ rule: LIMITS.admin }] },
  async (ctx) => {
    const { id } = parseParams(idParam, ctx.params);
    const user = ctx.user!;
    await adminTransition(new Types.ObjectId(id), ctx.body.to, { id: user._id, email: user.email, kind: "admin", requestId: ctx.requestId, ip: ctx.ip }, {
      note: ctx.body.note,
      confirm: ctx.body.confirm,
    });
    return { data: await getAdminOrder(id) };
  },
);
