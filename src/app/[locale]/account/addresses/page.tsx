import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { AccountAddresses } from "@/components/account/AccountPages";
import { AccountRoute, privateMetadata } from "@/components/account/AccountRoute";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("addresses"), ...privateMetadata };
}

export default async function AccountAddressesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");
  return (
    <AccountRoute title={t("addresses")} crumbs={[{ label: t("addresses") }]}>
      <AccountAddresses />
    </AccountRoute>
  );
}
