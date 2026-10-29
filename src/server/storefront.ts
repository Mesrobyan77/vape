import "server-only";
import type {
  BlogCard,
  BlogPost,
  Brand,
  Category,
  Facets,
  Locale,
  PageMeta,
  ProductCard,
  ProductDetail,
  ProductQuery,
  PublicSettings,
} from "@/lib/api/types";
import * as catalog from "./services/catalog";
import * as content from "./services/content";
import { publicSettings } from "./services/settings";

/**
 * Read API for Server Components. Pages call these directly (no HTTP hop).
 * Every function reads from MongoDB; callers render dynamically.
 */

export const getPublicSettings = (locale: Locale): Promise<PublicSettings> => publicSettings(locale);

export const listProducts = (query: ProductQuery, locale: Locale): Promise<{ items: ProductCard[]; meta: PageMeta }> => catalog.listProducts(query, locale);

export const getFacets = (query: ProductQuery, locale: Locale): Promise<Facets> => catalog.getFacets(query, locale);

export const getProduct = (slug: string, locale: Locale): Promise<ProductDetail | null> => catalog.getProduct(slug, locale);

export const listCategories = (locale: Locale): Promise<Category[]> => catalog.listCategories(locale);

export const listBrands = (): Promise<Brand[]> => catalog.listBrands();

export const listBlogPosts = (
  input: { page?: number; pageSize?: number; category?: string; q?: string },
  locale: Locale,
): Promise<{ items: BlogCard[]; meta: PageMeta }> => content.listBlogPosts(input, locale);

export const getBlogPost = (slug: string, locale: Locale): Promise<BlogPost | null> => content.getBlogPost(slug, locale);

export const listSitemapEntries = () => content.listSitemapEntries();

export const parseProductQuery = (sp: Record<string, string | string[] | undefined>): ProductQuery => catalog.parseProductQuery(sp);
