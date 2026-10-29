import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import type { Locale } from "@/lib/api/types";
import { safely } from "@/lib/safe";
import { alternatesFor, localizedUrl, SITE_URL } from "@/lib/site";
import { getBlogPost, listBlogPosts } from "@/server/storefront";
import { PageHeader } from "@/components/layout/PageHeader";
import { BlogCard } from "@/components/blog/BlogCard";
import { BlogSidebar } from "@/components/blog/BlogSidebar";
import { SafeImage } from "@/components/ui/SafeImage";
import { JsonLd } from "@/components/seo/JsonLd";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

const SLUG = /^[a-z0-9][a-z0-9-]{0,95}$/;
const loadPost = cache(async (slug: string, locale: Locale) => (SLUG.test(slug) ? getBlogPost(slug, locale) : null));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await loadPost(slug, locale).catch(() => null);
  if (!post) return { title: "404", robots: { index: false } };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: alternatesFor(locale, `/blog/${post.slug}`),
    openGraph: { type: "article", title: post.title, description: post.excerpt, images: post.coverImage ? [{ url: post.coverImage.url }] : undefined },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await loadPost(slug, locale);
  if (!post) notFound();
  const [t, format, recent] = await Promise.all([getTranslations("blog"), getFormatter(), safely(() => listBlogPosts({ pageSize: 8 }, locale))]);
  const others = recent.ok ? recent.data.items.filter((p) => p.slug !== post.slug) : [];
  const categories = [...new Set(others.map((p) => p.category).concat(post.category))];

  return (
    <>
      <PageHeader title={t("detailTitle")} titleAs="p" crumbs={[{ label: t("title"), href: "/blog" }, { label: post.title }]} />
      <section className="py-80">
        <div className="container-vh">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
            <div className="order-2 lg:order-1">
              <BlogSidebar categories={categories} recent={others.slice(0, 4)} activeCategory={post.category} tags={post.tags} />
            </div>
            <article className="surface order-1 min-w-0 p-4 sm:p-6 lg:order-2" data-testid="blog-article">
              <div className="mb-24">
                <SafeImage image={post.coverImage} width={1530} height={720} fit="cover" priority sizes="(min-width: 992px) 60vw, 100vw" alt={post.title} />
              </div>
              <h1 className="h3 mb-8 text-white">{post.title}</h1>
              <p className="mb-24 text-sm">
                <time dateTime={post.publishedAt}>{format.dateTime(new Date(post.publishedAt), { dateStyle: "long" })}</time> ·{" "}
                {t("minRead", { count: post.readMinutes })}
              </p>
              <div className="prose-vh lead !font-normal">
                {post.body.split(/\n{2,}/).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>
      {others.length ? (
        <section className="pb-80" aria-labelledby="more-posts">
          <div className="container-vh">
            <h2 id="more-posts" className="h4 mb-40 text-white">
              {t("moreLikeThis")}
            </h2>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {others.slice(0, 4).map((p) => (
                <li key={p.slug}>
                  <BlogCard post={p} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          datePublished: post.publishedAt,
          description: post.excerpt,
          inLanguage: locale,
          mainEntityOfPage: localizedUrl(locale, `/blog/${post.slug}`),
          image: post.coverImage ? [post.coverImage.url.startsWith("http") ? post.coverImage.url : `${SITE_URL}${post.coverImage.url}`] : undefined,
          publisher: { "@type": "Organization", name: "Vape Hub" },
        }}
      />
    </>
  );
}
