"use client";

import Image from "next/image";
import { Maximize2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type KeyboardEvent } from "react";
import type { Image as ImageData } from "@/lib/api/types";
import { useDialog } from "@/hooks/use-dialog";
import { SafeImage } from "@/components/ui/SafeImage";

export function ProductGallery({ images, productName }: { images: ImageData[]; productName: string }) {
  const t = useTranslations("product");
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);

  // A variant switch can change the image set.
  const signature = images.map((i) => i.url).join("|");
  const [shownSignature, setShownSignature] = useState(signature);
  if (shownSignature !== signature) {
    setShownSignature(signature);
    setIndex(0);
  }

  const current = images[index] ?? null;

  const onThumbKey = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (i + delta + images.length) % images.length;
    setIndex(next);
    thumbs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-4" data-testid="product-gallery">
      <div className="relative overflow-hidden rounded-[5px] bg-black">
        <SafeImage
          image={current}
          width={704}
          height={593}
          priority
          alt={current?.alt || productName}
          sizes="(min-width: 768px) 45vw, 100vw"
        />
        {current ? (
          <button
            type="button"
            className="icon-btn absolute right-3 top-3 rounded-full bg-black/60"
            onClick={() => setZoom(true)}
            aria-label={t("enlarge")}
            data-testid="gallery-zoom"
          >
            <Maximize2 className="!h-5 !w-5" aria-hidden />
          </button>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div role="group" aria-label={t("gallery")} className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-3 2xl:grid-cols-4">
          {images.map((image, i) => (
            <button
              key={`${image.url}-${i}`}
              ref={(el) => {
                thumbs.current[i] = el;
              }}
              type="button"
              className={`overflow-hidden rounded-[5px] border bg-black p-1 transition-colors ${i === index ? "border-primary-2" : "border-transparent hover:border-white/40"}`}
              aria-pressed={i === index}
              aria-label={t("showImage", { index: i + 1 })}
              onClick={() => setIndex(i)}
              onKeyDown={(e) => onThumbKey(e, i)}
              data-testid="gallery-thumb"
            >
              <SafeImage image={image} width={158} height={137} decorative sizes="120px" />
            </button>
          ))}
        </div>
      ) : null}
      {zoom && current ? <ZoomDialog image={current} productName={productName} onClose={() => setZoom(false)} /> : null}
    </div>
  );
}

function ZoomDialog({ image, productName, onClose }: { image: ImageData; productName: string; onClose: () => void }) {
  const t = useTranslations("product");
  const tCommon = useTranslations("common");
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, true, onClose);
  return (
    <div
      className="fixed inset-0 z-[10000] grid place-items-center bg-black/90 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={ref} role="dialog" aria-modal="true" aria-label={t("imageDialog")} className="relative max-h-full w-full max-w-[1100px]">
        <button type="button" className="icon-btn absolute -top-2 right-0 z-10 sm:-right-12" onClick={onClose} aria-label={tCommon("close")}>
          <X className="!h-8 !w-8" aria-hidden />
        </button>
        <Image
          src={image.url}
          alt={image.alt || productName}
          width={image.width}
          height={image.height}
          sizes="(min-width: 1100px) 1100px, 100vw"
          className="mx-auto max-h-[85vh] w-auto object-contain"
        />
      </div>
    </div>
  );
}
