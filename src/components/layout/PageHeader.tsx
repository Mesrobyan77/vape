import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/api/types";
import { localizedUrl } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";

export interface Crumb {
  label: string;
  href?: string;
}

/** Reference "page-header" band (background image + centred title) with breadcrumbs. */
export async function PageHeader({ title, crumbs = [], titleAs = "h1" }: { title: string; crumbs?: Crumb[]; titleAs?: "h1" | "p" }) {
  const Title = titleAs;
  const t = await getTranslations("common");
  const locale = (await getLocale()) as Locale;
  const trail: Crumb[] = [{ label: t("home"), href: "/" }, ...crumbs];

  return (
    <div className="page-header">
      <div className="page-header__content">
        {/* Pages that render their own <h1> (product, article) pass titleAs="p" so there is exactly one h1. */}
        <Title className="h2 text-white">{title}</Title>
        <nav aria-label={t("breadcrumb")}>
          <ol className="flex flex-wrap items-center justify-center gap-1 text-sm">
            {trail.map((crumb, i) => {
              const last = i === trail.length - 1;
              return (
                <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                  {crumb.href && !last ? (
                    <Link href={crumb.href} className="text-gray hover:text-primary-2">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-white" aria-current={last ? "page" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                  {!last ? <ChevronRight className="h-4 w-4 text-gray" aria-hidden /> : null}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((crumb, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: crumb.label,
            ...(crumb.href ? { item: localizedUrl(locale, crumb.href) } : {}),
          })),
        }}
      />
    </div>
  );
}
