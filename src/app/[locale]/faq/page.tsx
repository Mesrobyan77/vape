import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { safely } from "@/lib/safe";
import { alternatesFor } from "@/lib/site";
import { getPublicSettings } from "@/server/storefront";
import { PageHeader } from "@/components/layout/PageHeader";
import { JsonLd } from "@/components/seo/JsonLd";

type Props = { params: Promise<{ locale: Locale }> };
const ITEMS = ["age", "delivery", "payment", "vat", "reservation", "returns"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faq" });
  return { title: t("heading"), alternates: alternatesFor(locale, "/faq") };
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, settings] = await Promise.all([getTranslations("faq"), safely(() => getPublicSettings(locale))]);
  const shipping = settings.ok ? settings.data.shipping : { yerevanFee: 1000, otherFee: 2000, freeThreshold: 20000 };
  const values = { yerevan: formatAmd(shipping.yerevanFee), other: formatAmd(shipping.otherFee), threshold: formatAmd(shipping.freeThreshold) };
  const items = ITEMS.map((key) => ({ key, q: t(`items.${key}.q`), a: t(`items.${key}.a`, values) }));

  return (
    <>
      <PageHeader title={t("title")} crumbs={[{ label: t("title") }]} />
      <section className="py-80">
        <div className="container-vh">
          <h2 className="h4 mb-40 text-white">{t("heading")}</h2>
          <div className="space-y-4" data-testid="faq-list">
            {items.map((item) => (
              <details key={item.key} className="surface group rounded-[10px] p-5 open:ring-1 open:ring-primary/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white">
                  <span className="lead">{item.q}</span>
                  <span aria-hidden className="text-2xl text-primary-2 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
        }}
      />
    </>
  );
}
