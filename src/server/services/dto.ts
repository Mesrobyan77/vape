import type { Image, Locale } from "@/lib/api/types";
import { tr } from "../i18n";
import type { ImageRef } from "../models";

export function imageDto(img: ImageRef | null | undefined, locale: Locale, fallbackAlt = ""): Image | null {
  if (!img?.url) return null;
  return { url: img.url, alt: tr(img.alt, locale) || fallbackAlt, width: img.width, height: img.height };
}

export function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
