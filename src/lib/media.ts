/** Static storefront art lives on Cloudinary under `vapehub/media` (uploaded by `npm run media:upload`). */
export const MEDIA_BASE = "https://res.cloudinary.com/dzywgnadv/image/upload/vapehub/media";

/** `media("products/p-01.png")` → the Cloudinary URL of that file. */
export function media(path: string): string {
  return `${MEDIA_BASE}/${path}`;
}
