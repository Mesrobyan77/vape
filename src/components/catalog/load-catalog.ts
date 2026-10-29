import "server-only";
import type { Locale } from "@/lib/api/types";
import { DEFAULT_PAGE_SIZE, parseCatalogParams } from "@/lib/catalog-query";
import { safely } from "@/lib/safe";
import { getFacets, listProducts } from "@/server/storefront";
import type { CatalogInitial } from "./CatalogView";

/** Server-side first render of a catalog page; failures fall back to client fetching. */
export async function loadCatalog(searchParams: Record<string, string | string[] | undefined>, locale: Locale): Promise<CatalogInitial> {
  const query = parseCatalogParams(searchParams);
  const [products, facets] = await Promise.all([
    safely(() => listProducts({ ...query, pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE }, locale)),
    safely(() => getFacets({ ...query, page: undefined, pageSize: undefined, sort: undefined }, locale)),
  ]);
  return {
    query,
    items: products.ok ? products.data.items : null,
    meta: products.ok ? products.data.meta : null,
    facets: facets.ok ? facets.data : null,
  };
}
