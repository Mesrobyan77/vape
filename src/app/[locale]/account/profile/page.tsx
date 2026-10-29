import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { AccountProfile } from "@/components/account/AccountPages";
import { AccountRoute, privateMetadata } from "@/components/account/AccountRoute";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("profile"), ...privateMetadata };
}

export default async function AccountProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");
  return (
    <AccountRoute title={t("profile")} crumbs={[{ label: t("profile") }]}>
      <AccountProfile />
    </AccountRoute>
  );
}
