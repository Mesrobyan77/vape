import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { audit } from "@/server/services/audit";
import { deleteMedia } from "@/server/services/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const DELETE = handler<{ id: string }>({ auth: "admin", rateLimit: [{ rule: LIMITS.uploads }] }, async (ctx) => {
  const { id } = parseParams(idParam, ctx.params);
  await deleteMedia(id);
  await audit({ actorId: ctx.user!._id, actorEmail: ctx.user!.email, action: "upload.delete", targetType: "media", targetId: id, requestId: ctx.requestId, ip: ctx.ip });
  return { status: 204 };
});
