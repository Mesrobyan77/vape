/**
 * npm run media:upload [dir]   (default: public/media)
 * Uploads every file under the folder to Cloudinary as `vapehub/media/<path>` (the URLs the
 * storefront builds with `media()` in src/lib/media.ts). Existing assets are kept, so re-running is cheap.
 * Reads CLOUDINARY_* from the environment, or from .env.local / .env when present.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

const ROOT = path.resolve(process.argv[2] ?? "public/media");
const FOLDER = "vapehub/media";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

async function main(): Promise<void> {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) throw new Error("CLOUDINARY_* env vars are required");
  if (!existsSync(ROOT)) throw new Error(`${ROOT} not found`);
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });

  const files = walk(ROOT);
  let uploaded = 0;
  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const publicId = `${FOLDER}/${rel.replace(/\.[^.]+$/, "")}`;
    const res = await cloudinary.uploader.upload(file, { public_id: publicId, resource_type: "image", overwrite: false, unique_filename: false });
    uploaded++;
    console.log(`${rel} → ${res.secure_url}`);
  }
  console.log(`[media:upload] ${uploaded}/${files.length} files on Cloudinary (cloud "${CLOUDINARY_CLOUD_NAME}")`);
}

main().catch((err: unknown) => {
  console.error("[media:upload] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
