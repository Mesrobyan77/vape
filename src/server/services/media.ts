import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { fileTypeFromBuffer } from "file-type";
import sharp, { type Metadata } from "sharp";
import type { Types } from "mongoose";
import type { MediaRow, PexelsPhoto } from "@/lib/api/types";
import { config } from "../config";
import { connectDb } from "../db";
import { AppError } from "../errors";
import { logger } from "../logger";
import { BlogPost, Brand, Category, Media, Product, Settings, type MediaDoc } from "../models";
import { pageMeta } from "./dto";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_DIMENSION = 6000;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function configureCloudinary(): void {
  const cfg = config().cloudinary;
  if (!cfg) throw new AppError("UPLOADS_NOT_CONFIGURED");
  cloudinary.config({ cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret, secure: true });
}

/**
 * Validates an image by magic bytes (never the client MIME type), decodes it with sharp
 * to enforce real dimensions, and returns metadata. Throws 413/415/422.
 */
export async function validateImage(buffer: Buffer): Promise<{ mime: string; width: number; height: number }> {
  if (buffer.length === 0) throw new AppError("VALIDATION_FAILED", undefined, [{ path: "file", message: "empty" }]);
  if (buffer.length > MAX_UPLOAD_BYTES) throw new AppError("PAYLOAD_TOO_LARGE");
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !ALLOWED_MIME.has(type.mime)) throw new AppError("UNSUPPORTED_MEDIA_TYPE");
  let meta: Metadata;
  try {
    meta = await sharp(buffer, { limitInputPixels: MAX_DIMENSION * MAX_DIMENSION }).metadata();
  } catch {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "The image could not be decoded.");
  }
  if (!meta.width || !meta.height) throw new AppError("UNSUPPORTED_MEDIA_TYPE");
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    throw new AppError("VALIDATION_FAILED", undefined, [{ path: "file", message: `max ${MAX_DIMENSION}px` }]);
  }
  return { mime: type.mime, width: meta.width, height: meta.height };
}

const mediaRow = (m: MediaDoc): MediaRow => ({
  id: String(m._id),
  publicId: m.publicId,
  url: m.url,
  width: m.width,
  height: m.height,
  format: m.format,
  bytes: m.bytes,
  createdAt: m.createdAt.toISOString(),
});

export async function uploadImage(buffer: Buffer, uploadedBy: Types.ObjectId): Promise<MediaRow> {
  if (!config().cloudinary) throw new AppError("UPLOADS_NOT_CONFIGURED");
  await validateImage(buffer);
  configureCloudinary();
  let result: UploadApiResponse;
  try {
    result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "vapehub", resource_type: "image", overwrite: false, unique_filename: true },
        (err, res) => (err || !res ? reject(err ?? new Error("upload failed")) : resolve(res)),
      );
      stream.end(buffer);
    });
  } catch (err) {
    logger.error({ err }, "cloudinary upload failed");
    throw new AppError("SERVICE_UNAVAILABLE", "The image could not be uploaded. Please retry.");
  }
  await connectDb();
  const doc = await Media.create({
    publicId: result.public_id,
    url: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
    uploadedBy,
  });
  return mediaRow(doc.toObject());
}

export async function listMedia(page: number, pageSize: number) {
  await connectDb();
  const [docs, total] = await Promise.all([
    Media.find({ deletedAt: null }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean<MediaDoc[]>(),
    Media.countDocuments({ deletedAt: null }),
  ]);
  return { items: docs.map(mediaRow), meta: pageMeta(page, pageSize, total) };
}

async function isReferenced(url: string): Promise<boolean> {
  const [p, c, b, blog, s] = await Promise.all([
    Product.exists({ $or: [{ "images.url": url }, { "variants.images.url": url }] }),
    Category.exists({ "image.url": url }),
    Brand.exists({ "logo.url": url }),
    BlogPost.exists({ "coverImage.url": url }),
    Settings.exists({ "banners.image.url": url }),
  ]);
  return Boolean(p || c || b || blog || s);
}

export async function deleteMedia(id: string, opts: { force?: boolean } = {}): Promise<void> {
  await connectDb();
  const media = await Media.findOne({ _id: id, deletedAt: null });
  if (!media) throw new AppError("NOT_FOUND");
  if (!opts.force && (await isReferenced(media.url))) throw new AppError("CONFLICT", "This image is still used.");
  configureCloudinary();
  await cloudinary.uploader.destroy(media.publicId, { resource_type: "image" });
  await Media.updateOne({ _id: media._id }, { $set: { deletedAt: new Date() } });
}

/** Removes uploads older than 24h that nothing references (best-effort, safe to re-run). */
export async function cleanupOrphanMedia(now = new Date()): Promise<number> {
  if (!config().cloudinary) return 0;
  await connectDb();
  const candidates = await Media.find({ deletedAt: null, createdAt: { $lte: new Date(now.getTime() - 86_400_000) } }).limit(50);
  let removed = 0;
  for (const m of candidates) {
    if (await isReferenced(m.url)) continue;
    try {
      await deleteMedia(String(m._id), { force: true });
      removed += 1;
    } catch (err) {
      logger.warn({ err, publicId: m.publicId }, "orphan cleanup failed");
    }
  }
  return removed;
}

/* ---------------------------------------------------------------- Pexels */

interface PexelsApiPhoto {
  id?: unknown;
  width?: unknown;
  height?: unknown;
  alt?: unknown;
  photographer?: unknown;
  photographer_url?: unknown;
  url?: unknown;
  src?: { medium?: unknown; large?: unknown };
}

const isHttps = (v: unknown, host: RegExp): v is string => typeof v === "string" && v.startsWith("https://") && host.test(new URL(v).hostname);

/** Normalizes the Pexels response to a small, safe structure (drops anything unexpected). */
export function normalizePexels(payload: unknown): PexelsPhoto[] {
  const photos = (payload as { photos?: unknown })?.photos;
  if (!Array.isArray(photos)) return [];
  const out: PexelsPhoto[] = [];
  for (const raw of photos.slice(0, 40) as PexelsApiPhoto[]) {
    try {
      if (typeof raw.id !== "number" || typeof raw.width !== "number" || typeof raw.height !== "number") continue;
      if (!isHttps(raw.src?.medium, /(^|\.)pexels\.com$/) || !isHttps(raw.src?.large, /(^|\.)pexels\.com$/)) continue;
      out.push({
        id: raw.id,
        width: raw.width,
        height: raw.height,
        alt: typeof raw.alt === "string" ? raw.alt.slice(0, 200) : "",
        photographer: typeof raw.photographer === "string" ? raw.photographer.slice(0, 100) : "",
        photographerUrl: isHttps(raw.photographer_url, /(^|\.)pexels\.com$/) ? raw.photographer_url : "https://www.pexels.com",
        pexelsUrl: isHttps(raw.url, /(^|\.)pexels\.com$/) ? raw.url : "https://www.pexels.com",
        src: { medium: raw.src!.medium as string, large: raw.src!.large as string },
      });
    } catch {
      // malformed URL → skip entry
    }
  }
  return out;
}

const pexelsCache = new Map<string, { at: number; data: PexelsPhoto[] }>();
const PEXELS_TTL_MS = 10 * 60_000;

export async function searchPexels(q: string, page: number, orientation?: "landscape" | "portrait" | "square"): Promise<PexelsPhoto[]> {
  const key = config().pexelsApiKey;
  if (!key) throw new AppError("SERVICE_UNAVAILABLE", "Pexels is not configured.");
  const cacheKey = `${q.toLowerCase()}|${page}|${orientation ?? ""}`;
  const hit = pexelsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < PEXELS_TTL_MS) return hit.data;
  const params = new URLSearchParams({ query: q, page: String(page), per_page: "20", ...(orientation ? { orientation } : {}) });
  let res: Response;
  try {
    res = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, { headers: { Authorization: key }, signal: AbortSignal.timeout(6000) });
  } catch {
    throw new AppError("SERVICE_UNAVAILABLE", "Pexels did not respond.");
  }
  if (res.status === 429) throw new AppError("RATE_LIMITED", "Pexels rate limit reached.", { retryAfter: 60 });
  if (!res.ok) throw new AppError("SERVICE_UNAVAILABLE", "Pexels returned an error.");
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new AppError("SERVICE_UNAVAILABLE", "Pexels returned malformed data.");
  }
  const data = normalizePexels(json);
  pexelsCache.set(cacheKey, { at: Date.now(), data });
  if (pexelsCache.size > 200) pexelsCache.delete(pexelsCache.keys().next().value!);
  return data;
}
