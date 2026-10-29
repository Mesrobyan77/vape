import { revokeAllUserSessions } from "@/server/auth/session";
import { handler } from "@/server/http/handler";

export const dynamic = "force-dynamic";

export const POST = handler({ auth: "user" }, async (ctx) => {
  await revokeAllUserSessions(ctx.user!._id, ctx.session!._id);
  return { status: 204 };
});
