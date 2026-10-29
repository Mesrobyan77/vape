import { handler } from "@/server/http/handler";
import { Session } from "@/server/models";

export const dynamic = "force-dynamic";

export const GET = handler({ auth: "user" }, async (ctx) => {
  const now = new Date();
  const sessions = await Session.find({ userId: ctx.user!._id, revokedAt: null, expiresAt: { $gt: now } }).sort({ lastSeenAt: -1 }).limit(50).lean();
  return {
    data: sessions.map((s) => ({
      id: String(s._id),
      current: String(s._id) === String(ctx.session!._id),
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      userAgent: s.userAgent,
    })),
  };
});
