import { CalendarDays } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { BlogCard as BlogCardData } from "@/lib/api/types";
import { SafeImage } from "@/components/ui/SafeImage";

export function BlogCard({ post, headingLevel = 3 }: { post: BlogCardData; headingLevel?: 2 | 3 }) {
  const t = useTranslations("blog");
  const format = useFormatter();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative h-full overflow-hidden rounded-[10px] bg-black p-4 max-sm:p-2" data-testid="blog-card">
      <div className="mb-16 overflow-hidden">
        <SafeImage
          image={post.coverImage}
          width={462}
          height={498}
          fit="cover"
          decorative
          sizes="(min-width: 992px) 22vw, (min-width: 576px) 45vw, 100vw"
          className="transition-transform duration-[600ms] ease-linear group-hover:scale-105"
        />
      </div>
      <div className="mb-8 flex flex-wrap justify-between gap-2">
        <Heading className="h6">
          <Link
            href={`/blog/${post.slug}`}
            className="text-white transition-colors group-hover:text-primary-2 after:absolute after:inset-0 after:content-['']"
          >
            {post.title}
          </Link>
        </Heading>
        <p className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4" aria-hidden />
          <time dateTime={post.publishedAt}>{format.dateTime(new Date(post.publishedAt), { dateStyle: "medium" })}</time>
        </p>
      </div>
      <p className="mb-8 text-[11px] font-semibold tracking-wide">{t("minRead", { count: post.readMinutes })}</p>
      <p className="line-clamp-2">{post.excerpt}</p>
    </article>
  );
}
