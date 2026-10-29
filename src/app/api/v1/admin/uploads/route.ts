import { AppError } from "@/server/errors";
import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { audit } from "@/server/services/audit";
import { pageQuery } from "@/server/services/admin-schemas";
import { listMedia, MAX_UPLOAD_BYTES, uploadImage } from "@/server/services/media";
import { config } from "@/server/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handler({ auth: "admin", query: pageQuery, rateLimit: [{ rule: LIMITS.admin }] }, async (ctx) => {
  const { items, meta } = await listMedia(ctx.query.page, ctx.query.pageSize);
  return { data: items, meta };
});

/** Multipart upload (field "file"). Validated by magic bytes and decoded dimensions, then streamed to Cloudinary. */
export const POST = handler({ auth: "admin", rawBody: true, rateLimit: [{ rule: LIMITS.uploads }] }, async (ctx) => {
  if (!config().cloudinary) throw new AppError("UPLOADS_NOT_CONFIGURED");
  const declared = Number(ctx.req.headers.get("content-length") ?? "0");
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError("PAYLOAD_TOO_LARGE");
  let form: FormData;
  try {
    form = await ctx.req.formData();
  } catch {
    throw new AppError("BAD_REQUEST", "Expected multipart/form-data.");
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) throw new AppError("VALIDATION_FAILED", undefined, [{ path: "file", message: "required" }]);
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("PAYLOAD_TOO_LARGE");
  const media = await uploadImage(Buffer.from(await file.arrayBuffer()), ctx.user!._id);
  await audit({ actorId: ctx.user!._id, actorEmail: ctx.user!.email, action: "upload.create", targetType: "media", targetId: media.publicId, requestId: ctx.requestId, ip: ctx.ip });
  return { status: 201, data: media };
});
