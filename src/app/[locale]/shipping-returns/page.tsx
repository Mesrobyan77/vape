import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { safely } from "@/lib/safe";
import { alternatesFor } from "@/lib/site";
import { getPublicSettings } from "@/server/storefront";
import { LegalPage } from "@/components/content/LegalPage";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("shipping.title"), alternates: alternatesFor(locale, "/shipping-returns") };
}

export default async function ShippingReturnsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const settings = await safely(() => getPublicSettings(locale));
  const shipping = settings.ok ? settings.data.shipping : { yerevanFee: 1000, otherFee: 2000, freeThreshold: 20000 };
  return (
    <LegalPage
      doc="shipping"
      sections={["fees", "times", "returns", "warranty"]}
      values={{ yerevan: formatAmd(shipping.yerevanFee), other: formatAmd(shipping.otherFee), threshold: formatAmd(shipping.freeThreshold) }}
    />
  );
}
