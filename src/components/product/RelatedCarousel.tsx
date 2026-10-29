"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductCard as ProductCardData } from "@/lib/api/types";
import { ProductCard } from "./ProductCard";

/** Reference "Recommended Products" carousel (4 / 3 / 2 visible) using native scroll-snap. */
export function RelatedCarousel({ products, title }: { products: ProductCardData[]; title: string }) {
  const t = useTranslations("common");
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    update();
    const el = track.current;
    el?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduced ? "auto" : "smooth" });
  };

  if (products.length === 0) return null;

  return (
    <section className="pb-80" aria-labelledby="related-title">
      <div className="container-vh">
        <div className="mb-40 flex items-center justify-between gap-4">
          <h2 id="related-title" className="h4 text-white">
            {title}
          </h2>
          <div className="flex gap-3">
            <button type="button" className="cus-btn !p-2" onClick={() => scroll(-1)} disabled={edges.start} aria-label={t("previous")}>
              <ChevronLeft aria-hidden />
            </button>
            <button type="button" className="cus-btn !p-2" onClick={() => scroll(1)} disabled={edges.end} aria-label={t("next")}>
              <ChevronRight aria-hidden />
            </button>
          </div>
        </div>
        <ul
          ref={track}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:thin] sm:gap-6"
          data-testid="related-products"
        >
          {products.map((product) => (
            <li
              key={product.id}
              className="w-[calc((100%-1rem)/2)] shrink-0 snap-start sm:w-[calc((100%-3rem)/3)] 2xl:w-[calc((100%-4.5rem)/4)]"
            >
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
