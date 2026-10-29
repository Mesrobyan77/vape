import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cache, Suspense } from "react";
import type { Locale } from "@/lib/api/types";
import { alternatesFor, localizedUrl, SITE_URL } from "@/lib/site";
import { getProduct } from "@/server/storefront";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductDetailView } from "@/components/product/ProductDetailView";
import { RelatedCarousel } from "@/components/product/RelatedCarousel";
import { JsonLd } from "@/components/seo/JsonLd";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

const SLUG = /^[a-z0-9][a-z0-9-]{0,95}$/;

// One DB read per request even though metadata and the page both need the product.
const loadProduct = cache(async (slug: string, locale: Locale) => (SLUG.test(slug) ? getProduct(slug, locale) : null));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await loadProduct(slug, locale).catch(() => null);
  if (!product) return { title: "404", robots: { index: false } };
  const image = product.images[0];
  return {
    title: product.seo.title || product.name,
    description: product.seo.description || product.shortDescription,
    alternates: alternatesFor(locale, `/products/${product.slug}`),
    openGraph: {
      title: product.seo.title || product.name,
      description: product.seo.description || product.shortDescription,
      url: localizedUrl(locale, `/products/${product.slug}`),
      images: image ? [{ url: image.url, width: image.width, height: image.height, alt: image.alt }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = await loadProduct(slug, locale);
  if (!product) notFound();
  const [t, tNav] = await Promise.all([getTranslations("product"), getTranslations("nav")]);

  const prices = product.variants.map((v) => v.price);
  const inStock = product.variants.some((v) => v.available > 0);

  return (
    <>
      <PageHeader
        title={t("detailTitle")}
        titleAs="p"
        crumbs={[
          { label: tNav("shop"), href: "/shop" },
          ...(product.category ? [{ label: product.category.name, href: `/shop?category=${product.category.slug}` }] : []),
          { label: product.name },
        ]}
      />
      <section className="py-80">
        <div className="container-vh">
          <Suspense>
            <ProductDetailView initial={product} />
          </Suspense>
        </div>
      </section>
      <RelatedCarousel products={product.related} title={t("related")} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.shortDescription || product.description.slice(0, 300),
          sku: product.variants[0]?.sku,
          image: product.images.map((img) => (img.url.startsWith("http") ? img.url : `${SITE_URL}${img.url}`)),
          ...(product.brand ? { brand: { "@type": "Brand", name: product.brand.name } } : {}),
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "AMD",
            lowPrice: prices.length ? Math.min(...prices) : product.price,
            highPrice: prices.length ? Math.max(...prices) : product.price,
            offerCount: product.variants.length,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: localizedUrl(locale, `/products/${product.slug}`),
          },
        }}
      />
    </>
  );
}
