import { SORT_OPTIONS, type ProductQuery, type SortOption } from "./api/types";

export const PAGE_SIZES = [12, 16, 24, 48] as const;
export const DEFAULT_PAGE_SIZE = 12;
export const DEFAULT_SORT: SortOption = "newest";
const MAX_LIST = 20;
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_PRICE = 10_000_000;

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

function list(source: ParamSource, key: string, valid: (v: string) => boolean): string[] | undefined {
  const raw = read(source, key);
  if (!raw) return undefined;
  const values = [...new Set(raw.split(",").map((v) => v.trim().toLowerCase()))].filter(valid).slice(0, MAX_LIST);
  return values.length ? values : undefined;
}

function int(source: ParamSource, key: string, min: number, max: number): number | undefined {
  const raw = read(source, key);
  if (!raw || !/^\d{1,9}$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= min && n <= max ? n : undefined;
}

/**
 * Lenient parser for catalog URLs. Invalid or malicious values are dropped instead of
 * throwing, so a hand-edited URL can never crash the page (the API itself still
 * validates strictly).
 */
export function parseCatalogParams(source: ParamSource): ProductQuery {
  const sortRaw = read(source, "sort");
  const sort = SORT_OPTIONS.includes(sortRaw as SortOption) ? (sortRaw as SortOption) : undefined;
  const pageSize = int(source, "pageSize", 1, 48);
  const q = read(source, "q")?.trim().slice(0, 64);
  let minPrice = int(source, "minPrice", 0, MAX_PRICE);
  let maxPrice = int(source, "maxPrice", 0, MAX_PRICE);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
  const nicotine = list(source, "nicotine", (v) => /^\d{1,2}$/.test(v))?.map(Number);

  const query: ProductQuery = {
    page: int(source, "page", 1, 10_000),
    pageSize: pageSize && (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : undefined,
    sort,
    q: q && q.length > 0 ? q : undefined,
    category: list(source, "category", (v) => SLUG.test(v)),
    brand: list(source, "brand", (v) => SLUG.test(v)),
    flavor: list(source, "flavor", (v) => SLUG.test(v)),
    nicotine,
    minPrice,
    maxPrice,
    inStock: read(source, "inStock") === "true" ? true : undefined,
  };
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)) as ProductQuery;
}

/** Stable, minimal query string (defaults omitted) for URLs and cache keys. */
export function serializeCatalogQuery(query: ProductQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category?.length) params.set("category", [...query.category].sort().join(","));
  if (query.brand?.length) params.set("brand", [...query.brand].sort().join(","));
  if (query.flavor?.length) params.set("flavor", [...query.flavor].sort().join(","));
  if (query.nicotine?.length) params.set("nicotine", [...query.nicotine].sort((a, b) => a - b).join(","));
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
  if (query.inStock) params.set("inStock", "true");
  if (query.sort && query.sort !== DEFAULT_SORT) params.set("sort", query.sort);
  if (query.pageSize && query.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(query.pageSize));
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return params.toString();
}

/** Returns a copy with `patch` applied; any filter change resets pagination. */
export function updateQuery(query: ProductQuery, patch: Partial<ProductQuery>): ProductQuery {
  const next: ProductQuery = { ...query, ...patch };
  if (!("page" in patch)) delete next.page;
  for (const key of Object.keys(next) as (keyof ProductQuery)[]) {
    const value = next[key];
    if (value === undefined || (Array.isArray(value) && value.length === 0)) delete next[key];
  }
  return next;
}

export function toggleValue<T>(values: T[] | undefined, value: T): T[] {
  const current = values ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export function hasActiveFilters(query: ProductQuery): boolean {
  return Boolean(
    query.q ||
      query.category?.length ||
      query.brand?.length ||
      query.flavor?.length ||
      query.nicotine?.length ||
      query.minPrice !== undefined ||
      query.maxPrice !== undefined ||
      query.inStock,
  );
}
