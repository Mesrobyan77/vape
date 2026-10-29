import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/api/types";
import { localizedUrl } from "@/lib/site";
import { safely } from "@/lib/safe";
import { listSitemapEntries } from "@/server/storefront";

export const revalidate = 3600;

const STATIC_PATHS = ["/", "/shop", "/shop/sidebar", "/about", "/contact", "/faq", "/blog", "/privacy", "/terms", "/shipping-returns"];

function entry(path: string, lastModified?: string): MetadataRoute.Sitemap[number] {
  return {
    url: localizedUrl("hy", path),
    lastModified,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, localizedUrl(l, path)])) },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dynamic = await safely(() => listSitemapEntries());
  const products = dynamic.ok ? dynamic.data.products.map((p) => entry(`/products/${p.slug}`, p.updatedAt)) : [];
  const posts = dynamic.ok ? dynamic.data.posts.map((p) => entry(`/blog/${p.slug}`, p.updatedAt)) : [];
  return [...STATIC_PATHS.map((p) => entry(p)), ...products, ...posts];
}
