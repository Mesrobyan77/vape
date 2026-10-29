import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { safely } from "@/lib/safe";
import { alternatesFor } from "@/lib/site";
import { listBlogPosts } from "@/server/storefront";
import { PageHeader } from "@/components/layout/PageHeader";
import { BlogCard } from "@/components/blog/BlogCard";
import { BlogSidebar } from "@/components/blog/BlogSidebar";
import { EmptyState } from "@/components/ui/States";
import { Pagination } from "@/components/ui/Pagination";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return { title: t("title"), alternates: alternatesFor(locale, "/blog") };
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const pageRaw = Number(first(sp.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 && pageRaw < 1000 ? pageRaw : 1;
  const categoryRaw = first(sp.category);
  const category = categoryRaw && /^[a-z0-9-]{1,40}$/.test(categoryRaw) ? categoryRaw : undefined;
  const qRaw = first(sp.q)?.trim();
  const q = qRaw ? qRaw.slice(0, 64) : undefined;

  const [t, tCommon, posts, recent] = await Promise.all([
    getTranslations("blog"),
    getTranslations("common"),
    safely(() => listBlogPosts({ page, pageSize: 9, category, q }, locale)),
    safely(() => listBlogPosts({ pageSize: 4 }, locale)),
  ]);
  const categories = recent.ok ? [...new Set(recent.data.items.map((p) => p.category))] : [];

  const baseParams: Record<string, string> = {};
  if (category) baseParams.category = category;
  if (q) baseParams.q = q;

  return (
    <>
      <PageHeader title={t("title")} crumbs={[{ label: t("title") }]} />
      <section className="py-80">
        <div className="container-vh">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
            <div className="order-2 lg:order-1">
              <BlogSidebar categories={categories} recent={recent.ok ? recent.data.items : []} activeCategory={category} query={q} />
            </div>
            <div className="order-1 min-w-0 lg:order-2">
              {!posts.ok ? (
                <p role="alert" className="form-alert is-error">
                  {tCommon("genericError")}
                </p>
              ) : posts.data.items.length === 0 ? (
                <EmptyState title={t("empty")} />
              ) : (
                <>
                  <ul className="grid gap-6 sm:grid-cols-2 md:grid-cols-3" data-testid="blog-list">
                    {posts.data.items.map((post) => (
                      <li key={post.slug}>
                        <BlogCard post={post} headingLevel={2} />
                      </li>
                    ))}
                  </ul>
                  {posts.data.meta.totalPages > 1 ? <Pagination page={posts.data.meta.page} totalPages={posts.data.meta.totalPages} base={{ pathname: "/blog", params: baseParams }} /> : null}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
