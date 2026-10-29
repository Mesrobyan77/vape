import Image from "next/image";
import type { Metadata } from "next";
import { BadgeCheck, Headset, Truck, Wallet } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Category, Locale, ProductCard as ProductCardData } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { safely, type Result } from "@/lib/safe";
import { alternatesFor } from "@/lib/site";
import { getPublicSettings, listBlogPosts, listBrands, listCategories, listProducts } from "@/server/storefront";
import { ArrowRightIcon } from "@/components/icons";
import { ProductCard } from "@/components/product/ProductCard";
import { SafeImage } from "@/components/ui/SafeImage";
import { EmptyState } from "@/components/ui/States";
import { BrandMarquee } from "@/components/home/BrandMarquee";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { BlogCard } from "@/components/blog/BlogCard";
import { media } from "@/lib/media";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/") };
}

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  const [bestSellers, eJuices, featured, newest, categories, brands, posts, settings] = await Promise.all([
    safely(() => listProducts({ sort: "popularity", pageSize: 9 }, locale)),
    safely(() => listProducts({ category: ["e-juices"], sort: "popularity", pageSize: 4 }, locale)),
    safely(() => listProducts({ featured: true, sort: "newest", pageSize: 4 }, locale)),
    safely(() => listProducts({ sort: "newest", pageSize: 4 }, locale)),
    safely(() => listCategories(locale)),
    safely(() => listBrands()),
    safely(() => listBlogPosts({ pageSize: 3 }, locale)),
    safely(() => getPublicSettings(locale)),
  ]);

  const catalogEmpty = bestSellers.ok && bestSellers.data.meta.total === 0;
  const promo = settings.ok ? settings.data.banners.find((b) => b.placement === "promo") : undefined;

  return (
    <>
      {/* Hero */}
      <section className="py-80">
        <div className="container-vh">
          <div className="grid items-center gap-6 lg:grid-cols-2">
            <div>
              <p className="lead mb-16 text-white">{t("heroEyebrow")}</p>
              <h1 className="hero-title mb-16 text-white">
                {t("heroTitleBefore")} <span>{t("heroTitleAccent")}</span> {t("heroTitleAfter")}
              </h1>
              <p className="mb-48 max-w-[520px]">{t("heroText")}</p>
              <Link href="/shop" className="cus-btn" data-testid="hero-cta">
                {t("shopNow")}
                <ArrowRightIcon />
              </Link>
            </div>
            <div className="mx-auto w-full sm:w-10/12 md:w-8/12 lg:w-full">
              <Image
                src={media("banner/hero-image.png")}
                alt={t("heroImageAlt")}
                width={704}
                height={572}
                priority
                sizes="(min-width: 992px) 37vw, 90vw"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Experience banner */}
      <section className="py-80">
        <div className="container-vh">
          <div className="banner-1">
            <div className="mx-auto grid w-full items-center gap-6 px-4 md:w-11/12 md:grid-cols-3 2xl:w-10/12">
              <h2 className="text-white">{t("bannerTitle")}</h2>
              <div className="banner-1__object text-center">
                <Image src={media("banner/banner-object.png")} alt="" width={218} height={282} className="mx-auto h-auto w-[45%] md:w-auto" />
              </div>
              <div className="banner-1__logo mx-auto w-2/5 text-center md:mx-0 md:w-auto md:text-end">
                <Image src={media("banner/banner-logo.png")} alt="" width={340} height={195} className="ml-auto inline-block h-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {catalogEmpty ? (
        <section className="py-80">
          <div className="container-vh">
            <EmptyState title={t("emptyCatalogTitle")} body={t("emptyCatalogBody")} />
          </div>
        </section>
      ) : null}

      <CategoriesSection result={categories} title={t("categoriesTitle")} errorText={t("sectionError")} />

      <ProductSection
        title={t("bestSellers")}
        result={bestSellers.ok ? { ok: true, data: bestSellers.data.items } : bestSellers}
        errorText={t("sectionError")}
        cta={t("shopNow")}
        ctaHref="/shop?sort=popularity"
        hideNinthOnLarge
        priorityFirst
      />

      {/* Promo banner — "Explore E-Juices" */}
      <section className="py-80">
        <div className="container-vh">
          <Link href={promo?.link ?? "/shop?category=e-juices"} className="banner-2">
            <SafeImage
              image={promo?.image ?? { url: media("bg/banner-2-bg.png"), alt: "", width: 1432, height: 349 }}
              width={1432}
              height={349}
              fit="cover"
              decorative
              className="!h-full"
              sizes="(min-width: 1200px) 75vw, 100vw"
            />
            <h2 className="banner-2__title">{promo?.title || t("exploreEjuices")}</h2>
          </Link>
        </div>
      </section>

      <ProductSection
        title={t("eJuicesTitle")}
        result={eJuices.ok ? { ok: true, data: eJuices.data.items } : eJuices}
        errorText={t("sectionError")}
        cta={t("shopNow")}
        ctaHref="/shop?category=e-juices"
        hideFourthOnMedium
      />

      {featured.ok && featured.data.items.length > 0 ? (
        <div className="pt-80">
          <ProductSection title={t("featured")} result={{ ok: true, data: featured.data.items }} errorText={t("sectionError")} />
        </div>
      ) : null}

      {newest.ok && newest.data.items.length > 0 ? (
        <div className="pt-80">
          <ProductSection
            title={t("newArrivals")}
            result={{ ok: true, data: newest.data.items }}
            errorText={t("sectionError")}
            cta={t("shopNow")}
            ctaHref="/shop?sort=newest"
          />
        </div>
      ) : null}

      {brands.ok ? <BrandMarquee brands={brands.data} label={t("brandsTitle")} /> : null}

      {/* Benefits, delivery and support */}
      <section className="pb-80" aria-labelledby="benefits-title">
        <div className="container-vh">
          <h2 id="benefits-title" className="h4 mb-40 text-center text-white">
            {t("benefitsTitle")}
          </h2>
          <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { Icon: BadgeCheck, title: t("benefits.originalTitle"), text: t("benefits.originalText") },
              {
                Icon: Truck,
                title: t("benefits.deliveryTitle"),
                text: settings.ok
                  ? t("benefits.deliveryText", {
                      yerevan: formatAmd(settings.data.shipping.yerevanFee),
                      other: formatAmd(settings.data.shipping.otherFee),
                      threshold: formatAmd(settings.data.shipping.freeThreshold),
                    })
                  : t("benefits.deliveryTitle"),
              },
              { Icon: Wallet, title: t("benefits.paymentTitle"), text: t("benefits.paymentText") },
              { Icon: Headset, title: t("benefits.supportTitle"), text: t("benefits.supportText") },
            ].map(({ Icon, title, text }) => (
              <li key={title} className="surface rounded-[10px] p-6">
                <Icon className="mb-16 h-9 w-9 text-primary-2" aria-hidden />
                <h3 className="h6 mb-8 text-white">{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {posts.ok && posts.data.items.length > 0 ? (
        <section className="pb-80" aria-labelledby="blog-preview-title">
          <div className="container-vh">
            <h2 id="blog-preview-title" className="h4 mb-40 text-center text-white">
              {t("blogTitle")}
            </h2>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.data.items.map((post) => (
                <li key={post.slug}>
                  <BlogCard post={post} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Newsletter */}
      <NewsletterSection />
    </>
  );
}

async function NewsletterSection() {
  const t = await getTranslations("newsletter");
  return (
    <section className="newsletter py-80" aria-labelledby="newsletter-title">
      <div className="container-vh">
        <div className="grid items-center gap-6 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <h2 id="newsletter-title" className="h4 mb-12 text-white">
              {t("title")}
            </h2>
            <p className="text-white">{t("text")}</p>
          </div>
          <div className="mx-auto w-full sm:w-10/12 md:w-8/12 lg:w-full">
            <NewsletterForm />
          </div>
        </div>
      </div>
    </section>
  );
}

function isTall(category: Category) {
  return category.image ? category.image.height > category.image.width : false;
}

function CategoriesSection({ result, title, errorText }: { result: Result<Category[]>; title: string; errorText: string }) {
  if (!result.ok) {
    return (
      <section className="py-80">
        <div className="container-vh">
          <p className="text-center" role="alert">
            {errorText}
          </p>
        </div>
      </section>
    );
  }
  const small = result.data.filter(isTall).slice(0, 5);
  const large = result.data.filter((c) => c.image && !isTall(c)).slice(0, 2);
  if (small.length === 0 && large.length === 0) return null;
  return (
    <section className="py-80" aria-labelledby="categories-title">
      <div className="container-vh">
        <h2 id="categories-title" className="h4 mb-40 text-center text-white">
          {title}
        </h2>
        {small.length ? (
          <ul className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
            {small.map((category, i) => (
              <li key={category.slug} className={i === 4 ? "hidden lg:block" : undefined}>
                <Link href={`/shop?category=${category.slug}`} className="category-card">
                  <div className="category-card__media">
                    <SafeImage image={category.image} width={236} height={332} decorative sizes="(min-width: 992px) 14vw, 45vw" />
                  </div>
                  <h3 className="h6">{category.name}</h3>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {large.length ? (
          <ul className="grid gap-4 pt-80 sm:gap-6 md:grid-cols-2">
            {large.map((category) => (
              <li key={category.slug}>
                <Link href={`/shop?category=${category.slug}`} className="category-card-2">
                  <SafeImage image={category.image} width={704} height={360} fit="cover" decorative sizes="(min-width: 768px) 37vw, 100vw" />
                  <h3 className="h3 category-card-2__title">{category.name}</h3>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function ProductSection({
  title,
  result,
  errorText,
  cta,
  ctaHref,
  hideNinthOnLarge,
  hideFourthOnMedium,
  priorityFirst,
}: {
  title: string;
  result: Result<ProductCardData[]>;
  errorText: string;
  cta?: string;
  ctaHref?: string;
  hideNinthOnLarge?: boolean;
  hideFourthOnMedium?: boolean;
  priorityFirst?: boolean;
}) {
  if (result.ok && result.data.length === 0) return null;
  const headingId = `section-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={headingId}>
      <div className="container-vh">
        <h2 id={headingId} className="h4 mb-40 text-center text-white">
          {title}
        </h2>
        {result.ok ? (
          <>
            <ul className="mb-48 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {result.data.map((product, i) => {
                let visibility = "";
                // Mirror the reference: 8 cards on desktop (4×2), 9 on tablet (3×3).
                if (hideNinthOnLarge && i === 8) visibility = "hidden md:block lg:hidden";
                else if (hideNinthOnLarge && i > 8) visibility = "hidden";
                // E-juices: 4 on desktop/mobile, 3 on tablet.
                if (hideFourthOnMedium && i === 3) visibility = "block md:hidden lg:block";
                return (
                  <li key={product.id} className={visibility || undefined}>
                    <ProductCard product={product} priority={priorityFirst && i < 2} />
                  </li>
                );
              })}
            </ul>
            {cta && ctaHref ? (
              <Link href={ctaHref} className="cus-btn mx-auto flex">
                {cta}
                <ArrowRightIcon />
              </Link>
            ) : null}
          </>
        ) : (
          <p className="text-center" role="alert">
            {errorText}
          </p>
        )}
      </div>
    </section>
  );
}
