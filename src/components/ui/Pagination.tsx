"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { Link } from "@/i18n/navigation";

/** Pages to show: first, last, current ±1, with gaps marked as null. */
export function pageWindow(page: number, totalPages: number): (number | null)[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push(null);
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  hrefFor: hrefForProp,
  base,
  onNavigate,
}: {
  page: number;
  totalPages: number;
  /** Client callers can build hrefs with a function… */
  hrefFor?: (page: number) => string;
  /** …Server Components pass serializable data instead. */
  base?: { pathname: string; params?: Record<string, string> };
  onNavigate?: (page: number) => void;
}) {
  const t = useTranslations("common");
  const hrefFor =
    hrefForProp ??
    ((p: number) => {
      const params = new URLSearchParams(base?.params);
      if (p > 1) params.set("page", String(p));
      else params.delete("page");
      const qs = params.toString();
      return `${base?.pathname ?? ""}${qs ? `?${qs}` : ""}`;
    });
  // Real links (crawlable, open-in-new-tab) that navigate client-side when possible.
  const click = (target: number) => (event: MouseEvent) => {
    if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(target);
  };

  return (
    <nav aria-label={t("pagination")} data-testid="pagination">
      <ul className="pagination">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} onClick={click(page - 1)} aria-label={t("previous")} rel="prev">
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </Link>
          ) : (
            <span aria-hidden className="opacity-40">
              <ChevronLeft className="h-5 w-5" />
            </span>
          )}
        </li>
        {pageWindow(page, totalPages).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden>
              <span className="!bg-transparent">…</span>
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                onClick={click(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={t("pageN", { page: p })}
              >
                {String(p).padStart(2, "0")}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} onClick={click(page + 1)} aria-label={t("next")} rel="next">
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Link>
          ) : (
            <span aria-hidden className="opacity-40">
              <ChevronRight className="h-5 w-5" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
