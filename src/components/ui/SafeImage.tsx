"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Image as ImageData } from "@/lib/api/types";

interface Props {
  image: ImageData | null;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Alt text supplied by the caller (overrides image.alt). */
  alt?: string;
  /** Mark as decorative when an adjacent text link already names the content. */
  decorative?: boolean;
  fit?: "contain" | "cover";
}

/**
 * next/image with a stable aspect-ratio box and a designed fallback when the source is
 * missing or fails to load (no broken-image icons).
 */
export function SafeImage({ image, width, height, sizes, priority, className = "", alt, decorative, fit = "contain" }: Props) {
  const t = useTranslations("product");
  const [failed, setFailed] = useState(false);
  const ratio = `${width} / ${height}`;

  if (!image || failed) {
    return (
      <div
        className={`grid w-full place-items-center rounded-[5px] bg-[#16171a] text-gray ${className}`}
        style={{ aspectRatio: ratio }}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : t("noImage")}
        aria-hidden={decorative ? true : undefined}
        data-testid="image-fallback"
      >
        <ImageOff className="h-8 w-8 opacity-60" aria-hidden />
      </div>
    );
  }

  return (
    <Image
      src={image.url}
      alt={decorative ? "" : (alt ?? image.alt)}
      width={image.width || width}
      height={image.height || height}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      className={`h-auto w-full ${fit === "cover" ? "object-cover" : "object-contain"} ${className}`}
      style={{ aspectRatio: ratio }}
      onError={() => setFailed(true)}
    />
  );
}
