import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { alternatesFor } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { CheckoutView } from "@/components/checkout/CheckoutView";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("title"), alternates: alternatesFor(locale, "/checkout"), robots: { index: false } };
}

export default async function CheckoutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tCart] = await Promise.all([getTranslations("checkout"), getTranslations("cart")]);
  return (
    <>
      <PageHeader title={t("title")} crumbs={[{ label: tCart("title"), href: "/cart" }, { label: t("title") }]} />
      <section className="py-80">
        <div className="container-vh">
          <CheckoutView />
        </div>
      </section>
    </>
  );
}
