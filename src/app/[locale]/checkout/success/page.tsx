import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderStatusView } from "@/components/checkout/OrderStatusView";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ order?: string | string[] }> };

const ORDER_NUMBER = /^VH-\d{6}-[A-Z0-9]{6}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "success" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CheckoutSuccessPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = (await searchParams).order;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const orderNumber = value && ORDER_NUMBER.test(value) ? value : null;
  const t = await getTranslations("success");
  return (
    <>
      <PageHeader title={t("title")} crumbs={[{ label: t("title") }]} />
      <section className="py-80">
        <div className="container-vh">
          <OrderStatusView orderNumber={orderNumber} />
        </div>
      </section>
    </>
  );
}
