import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { alternatesFor } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { CartPageView } from "@/components/cart/CartPageView";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cart" });
  return { title: t("title"), alternates: alternatesFor(locale, "/cart"), robots: { index: false } };
}

export default async function CartPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("cart");
  return (
    <>
      <PageHeader title={t("title")} crumbs={[{ label: t("title") }]} />
      <section className="py-80">
        <div className="container-vh">
          <CartPageView />
        </div>
      </section>
    </>
  );
}
