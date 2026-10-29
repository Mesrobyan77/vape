import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import type { Locale } from "@/lib/api/types";
import { alternatesFor } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { CatalogView } from "@/components/catalog/CatalogView";
import { loadCatalog } from "@/components/catalog/load-catalog";
import { EmptyState } from "@/components/ui/States";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  // Result pages are not indexed; the canonical points at the empty search page.
  return { title: t("title"), alternates: alternatesFor(locale, "/search"), robots: { index: false, follow: true } };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("search");
  const initial = await loadCatalog(sp, locale);
  const q = initial.query.q;

  return (
    <>
      <PageHeader title={q ? t("resultsFor", { q }) : t("title")} crumbs={[{ label: t("title") }]} />
      <section className="py-80">
        <div className="container-vh">
          {q ? (
            <Suspense>
              <CatalogView variant="sidebar" initial={initial} searchMode />
            </Suspense>
          ) : (
            <EmptyState title={t("emptyQuery")} />
          )}
        </div>
      </section>
    </>
  );
}
