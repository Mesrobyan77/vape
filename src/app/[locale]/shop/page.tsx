import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import type { Locale } from "@/lib/api/types";
import { alternatesFor } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { CatalogView } from "@/components/catalog/CatalogView";
import { loadCatalog } from "@/components/catalog/load-catalog";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shop" });
  return { title: t("title"), alternates: alternatesFor(locale, "/shop") };
}

export default async function ShopGridPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tNav, initial] = await Promise.all([getTranslations("shop"), getTranslations("nav"), loadCatalog(await searchParams, locale)]);
  return (
    <>
      <PageHeader title={t("title")} crumbs={[{ label: tNav("shopGrid") }]} />
      <section className="py-80">
        <div className="container-vh">
          <Suspense>
            <CatalogView variant="grid" initial={initial} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
