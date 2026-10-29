import { CalendarDays } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { BlogCard } from "@/lib/api/types";
import { SafeImage } from "@/components/ui/SafeImage";
import { SearchIcon } from "@/components/icons";

export async function BlogSidebar({
  categories,
  recent,
  activeCategory,
  query,
  tags,
}: {
  categories: string[];
  recent: BlogCard[];
  activeCategory?: string;
  query?: string;
  tags?: string[];
}) {
  const t = await getTranslations("blog");
  const format = await getFormatter();
  return (
    <aside className="sidebar" aria-label={t("title")}>
      <div className="sidebar-widget">
        <form role="search" action="" method="get" className="search-field">
          <label htmlFor="blog-search" className="sr-only">
            {t("searchPlaceholder")}
          </label>
          <input id="blog-search" type="search" name="q" defaultValue={query} maxLength={64} placeholder={t("searchPlaceholder")} />
          <button type="submit" className="icon-btn !min-h-8 !min-w-8 !text-gray" aria-label={t("searchPlaceholder")}>
            <SearchIcon className="!h-4 !w-4" />
          </button>
        </form>
      </div>
      {categories.length ? (
        <section className="sidebar-widget">
          <h2 className="lead mb-16 text-white">{t("categories")}</h2>
          <ul className="flex flex-col gap-2">
            <li>
              <Link href="/blog" aria-current={!activeCategory ? "page" : undefined} className="text-white hover:text-primary-2 aria-[current=page]:text-primary-2">
                {t("allCategories")}
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category}>
                <Link
                  href={`/blog?category=${encodeURIComponent(category)}`}
                  aria-current={activeCategory === category ? "page" : undefined}
                  className="capitalize text-white hover:text-primary-2 aria-[current=page]:text-primary-2"
                >
                  {category.replace(/-/g, " ")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {recent.length ? (
        <section className="sidebar-widget">
          <h2 className="lead mb-16 text-white">{t("recentPosts")}</h2>
          <ul className="flex flex-col gap-4">
            {recent.map((post) => (
              <li key={post.slug}>
                <Link href={`/blog/${post.slug}`} className="group flex items-center gap-3">
                  <span className="w-[60px] shrink-0 overflow-hidden rounded-[5px]">
                    <SafeImage image={post.coverImage} width={60} height={60} fit="cover" decorative sizes="60px" />
                  </span>
                  <span>
                    <span className="mb-1 flex items-center gap-1 text-xs">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      {format.dateTime(new Date(post.publishedAt), { dateStyle: "medium" })}
                    </span>
                    <span className="text-white transition-colors group-hover:text-primary-2">{post.title}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {tags && tags.length ? (
        <section className="sidebar-widget">
          <h2 className="lead mb-16 text-white">{t("tags")}</h2>
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <Link href={`/blog?q=${encodeURIComponent(tag)}`} className="chip">
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
