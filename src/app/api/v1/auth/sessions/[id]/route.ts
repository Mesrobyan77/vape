import { AppError } from "@/server/errors";
import { handler, idParam, parseParams } from "@/server/http/handler";
import { Session } from "@/server/models";

export const dynamic = "force-dynamic";

/** Revokes one of the caller's own sessions (scoped by user id — never another user's). */
export const DELETE = handler<{ id: string }>({ auth: "user" }, async (ctx) => {
  const { id } = parseParams(idParam, ctx.params);
  const res = await Session.updateOne({ _id: id, userId: ctx.user!._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  if (res.modifiedCount !== 1) throw new AppError("NOT_FOUND");
  if (id === String(ctx.session!._id)) await ctx.endSession();
  return { status: 204 };
});
