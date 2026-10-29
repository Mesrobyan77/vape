"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { SlidersHorizontal, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { apiPage, api } from "@/lib/api/client";
import type { Facets, Locale, PageMeta, ProductCard as ProductCardData, ProductQuery, SortOption } from "@/lib/api/types";
import { SORT_OPTIONS } from "@/lib/api/types";
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  PAGE_SIZES,
  hasActiveFilters,
  parseCatalogParams,
  serializeCatalogQuery,
  updateQuery,
} from "@/lib/catalog-query";
import { useDialog } from "@/hooks/use-dialog";
import { useErrorMessage } from "@/hooks/use-error-message";
import { ProductCard, ProductCardSkeleton } from "@/components/product/ProductCard";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Pagination } from "@/components/ui/Pagination";
import { FiltersPanel, ActiveFilters } from "./Filters";

export interface CatalogInitial {
  query: ProductQuery;
  items: ProductCardData[] | null;
  meta: PageMeta | null;
  facets: Facets | null;
}

interface Props {
  variant: "grid" | "sidebar";
  initial: CatalogInitial;
  /** Search page: the free-text query is part of the page, not a removable chip. */
  searchMode?: boolean;
}

export function CatalogView({ variant, initial, searchMode = false }: Props) {
  const t = useTranslations("shop");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const errorMessage = useErrorMessage();
  const query = useMemo(() => parseCatalogParams(searchParams), [searchParams]);
  const key = serializeCatalogQuery(query);
  const initialKey = serializeCatalogQuery(initial.query);
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

  const products = useQuery({
    queryKey: ["products", locale, key],
    queryFn: ({ signal }) =>
      apiPage<ProductCardData[]>("/products", { query: { ...toApiQuery(query), pageSize, locale }, signal }),
    initialData: key === initialKey && initial.items && initial.meta ? { data: initial.items, meta: initial.meta } : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const facetKey = serializeCatalogQuery({ ...query, page: undefined, pageSize: undefined, sort: undefined });
  const initialFacetKey = serializeCatalogQuery({ ...initial.query, page: undefined, pageSize: undefined, sort: undefined });
  const facets = useQuery({
    queryKey: ["facets", locale, facetKey],
    queryFn: ({ signal }) => api<Facets>("/products/facets", { query: { ...toApiQuery({ ...query, page: undefined }), locale }, signal }),
    initialData: facetKey === initialFacetKey && initial.facets ? initial.facets : undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  // Client-side URL state: Next keeps useSearchParams in sync with the History API, so filter
  // changes fetch only the API (no server re-render) and every change is a Back/Forward step.
  const navigate = useCallback((next: ProductQuery, options: { scroll?: boolean } = {}) => {
    const qs = serializeCatalogQuery(next);
    const path = window.location.pathname;
    window.history.pushState(null, "", qs ? `${path}?${qs}` : path);
    if (options.scroll) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    }
  }, []);

  const onFilterChange = useCallback((patch: Partial<ProductQuery>) => navigate(updateQuery(query, patch)), [navigate, query]);

  const clearAll = () => navigate(searchMode && query.q ? { q: query.q } : {});

  const items = products.data?.data ?? [];
  const meta = products.data?.meta;
  const updating = products.isPlaceholderData && products.isFetching;
  const from = meta && meta.total > 0 ? (meta.page - 1) * meta.pageSize + 1 : 0;
  const to = meta ? Math.min(meta.total, meta.page * meta.pageSize) : 0;

  return (
    <div className={variant === "sidebar" ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]" : ""}>
      {variant === "sidebar" ? (
        <aside className="hidden lg:block" aria-label={t("filters")}>
          <div className="sidebar">
            <FiltersPanel facets={facets.data ?? null} query={query} onChange={onFilterChange} loading={facets.isFetching} showSearch />
          </div>
        </aside>
      ) : null}

      <div className="min-w-0">
        <div className="filter-bar mb-48">
          <div className="filter-row">
            <div className="flex flex-wrap items-center gap-3">
              <FilterDrawerButton
                hideOnLarge={variant === "sidebar"}
                facets={facets.data ?? null}
                query={query}
                onChange={onFilterChange}
                loading={facets.isFetching}
                total={meta?.total}
              />
              <p aria-live="polite" data-testid="results-count">
                {meta ? (meta.total > 0 ? t("showing", { from, to, total: meta.total }) : t("showingNone")) : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
              <label className="flex items-center gap-2 text-white max-sm:w-full">
                <span className="shrink-0">{t("sortBy")}</span>
                <span className="form-group min-w-[190px]">
                  <select
                    value={query.sort ?? DEFAULT_SORT}
                    onChange={(e) => onFilterChange({ sort: e.target.value as SortOption })}
                    data-testid="sort-select"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {t(`sort.${option}`)}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="flex items-center gap-2 text-white">
                <span className="shrink-0">{t("perPage")}</span>
                <span className="form-group w-[96px]">
                  <select
                    value={pageSize}
                    onChange={(e) => onFilterChange({ pageSize: Number(e.target.value) })}
                    data-testid="page-size-select"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            </div>
          </div>
          {hasActiveFilters(query) ? (
            <ActiveFilters query={query} facets={facets.data ?? null} onChange={onFilterChange} onClearAll={clearAll} hideQuery={searchMode} />
          ) : null}
        </div>

        <p className="sr-only" aria-live="polite">
          {updating ? t("updating") : meta ? t("resultsUpdated", { total: meta.total }) : ""}
        </p>

        {products.isError && !products.data ? (
          <ErrorState message={`${t("loadError")} ${errorMessage(products.error)}`} onRetry={() => products.refetch()} retrying={products.isFetching} />
        ) : !products.data ? (
          <ProductGridSkeleton count={pageSize > 12 ? 12 : pageSize} variant={variant} />
        ) : (
          <>
            {products.isError ? (
              <div className="mb-24">
                <ErrorState compact message={`${t("loadError")} ${errorMessage(products.error)}`} onRetry={() => products.refetch()} retrying={products.isFetching} />
              </div>
            ) : null}
            {updating ? (
              <ProductGridSkeleton count={Math.max(items.length, 3)} variant={variant} />
            ) : items.length === 0 ? (
              <EmptyState
                title={t("noResultsTitle")}
                body={t("noResultsBody")}
                action={
                  hasActiveFilters(query) ? (
                    <button type="button" className="cus-btn" onClick={clearAll}>
                      {t("clearAll")}
                    </button>
                  ) : null
                }
              />
            ) : (
              <ul className={gridClass(variant)} data-testid="product-grid">
                {items.map((product, i) => (
                  <li key={product.id}>
                    <ProductCard product={product} priority={i < 2} headingLevel={2} />
                  </li>
                ))}
              </ul>
            )}
            {meta && meta.totalPages > 1 ? (
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                hrefFor={(page) => {
                  const qs = serializeCatalogQuery(updateQuery(query, { page }));
                  return qs ? `${pathname}?${qs}` : pathname;
                }}
                onNavigate={(page) => navigate(updateQuery(query, { page }), { scroll: true })}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function toApiQuery(query: ProductQuery): Record<string, string | number | boolean | string[] | number[] | undefined> {
  return {
    q: query.q,
    category: query.category,
    brand: query.brand,
    flavor: query.flavor,
    nicotine: query.nicotine,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    inStock: query.inStock ? true : undefined,
    sort: query.sort ?? DEFAULT_SORT,
    page: query.page,
  };
}

function gridClass(variant: "grid" | "sidebar") {
  return variant === "grid"
    ? "grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
    : "grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 sm:gap-6 md:grid-cols-3";
}

function ProductGridSkeleton({ count, variant }: { count: number; variant: "grid" | "sidebar" }) {
  const t = useTranslations("common");
  return (
    <ul className={gridClass(variant)} aria-busy="true" aria-label={t("loading")}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <ProductCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

function FilterDrawerButton({
  hideOnLarge,
  facets,
  query,
  onChange,
  loading,
  total,
}: {
  hideOnLarge: boolean;
  facets: Facets | null;
  query: ProductQuery;
  onChange: (patch: Partial<ProductQuery>) => void;
  loading: boolean;
  total: number | undefined;
}) {
  const t = useTranslations("shop");
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpenState] = useState(false);
  useDialog(ref, open, () => setOpenState(false));

  return (
    <>
      <button
        type="button"
        className={`filter-btn ${hideOnLarge ? "lg:hidden" : ""}`}
        onClick={() => setOpenState(true)}
        aria-expanded={open}
        aria-controls="filters-drawer"
        data-testid="open-filters"
      >
        <SlidersHorizontal className="h-5 w-5" aria-hidden />
        {t("filters")}
      </button>
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              key="filters-overlay"
              className="fixed inset-0 z-[1000] bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenState(false)}
              aria-hidden
            />
            <motion.div
              key="filters-drawer"
              id="filters-drawer"
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-label={t("filters")}
              className="drawer-panel left-0 flex w-[min(360px,90vw)] flex-col"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3 }}
              data-testid="filters-drawer"
            >
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <h2 className="h6 text-white">{t("filters")}</h2>
                <button type="button" className="icon-btn" onClick={() => setOpenState(false)} aria-label={t("closeFilters")}>
                  <X aria-hidden />
                </button>
              </div>
              <div className="sidebar flex-1 overflow-y-auto">
                <FiltersPanel facets={facets} query={query} onChange={onChange} loading={loading} showSearch />
              </div>
              <div className="border-t border-white/10 p-4">
                <button type="button" className="cus-btn is-filled w-full" onClick={() => setOpenState(false)}>
                  {t("showResults")}
                  {total !== undefined ? ` (${total})` : null}
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
