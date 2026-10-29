import Image from "next/image";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { safely } from "@/lib/safe";
import { alternatesFor } from "@/lib/site";
import { getPublicSettings, listBrands } from "@/server/storefront";
import { PageHeader } from "@/components/layout/PageHeader";
import { BrandMarquee } from "@/components/home/BrandMarquee";
import { media } from "@/lib/media";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("title"), description: t("body").slice(0, 160), alternates: alternatesFor(locale, "/about") };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tHome, brands, settings] = await Promise.all([
    getTranslations("about"),
    getTranslations("home"),
    safely(() => listBrands()),
    safely(() => getPublicSettings(locale)),
  ]);
  const address = settings.ok ? settings.data.store.address : null;

  return (
    <>
      <PageHeader title={t("title")} crumbs={[{ label: t("title") }]} />
      <section className="py-80">
        <div className="container-vh">
          <div className="grid items-center gap-12 md:grid-cols-2 md:gap-6">
            <div>
              <p className="lead mb-16 text-white">{t("eyebrow")}</p>
              <h2 className="h1 mb-16 text-white">{t("heading")}</h2>
              <p className="mb-16">{t("body")}</p>
              <p>{t("body2")}</p>
            </div>
            <Image src={media("about/about.jpg")} alt={t("imageAlt")} width={1128} height={801} sizes="(min-width: 768px) 37vw, 100vw" className="h-auto w-full" />
          </div>
        </div>
      </section>

      {brands.ok ? <BrandMarquee brands={brands.data} label={tHome("brandsTitle")} /> : null}

      <section className="py-80">
        <div className="container-vh">
          <div className="grid gap-12 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-6">
            <div>
              <h2 className="h4 mb-24 text-white">{t("findUs")}</h2>
              {address ? (
                <div className="surface mb-24 flex items-center gap-6 p-6">
                  <MapPin className="h-8 w-8 shrink-0 text-primary-2" aria-hidden />
                  <div>
                    <p className="mb-1 font-bold text-white">{t("visitTitle")}</p>
                    <p>{address}</p>
                    {settings.ok ? <p className="mt-1 text-sm">{settings.data.store.hours}</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="overflow-hidden">
              <iframe
                title={t("mapTitle")}
                src="https://www.google.com/maps?q=Yerevan%2C%20Armenia&output=embed"
                className="h-[clamp(350px,26.042vw,650px)] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
