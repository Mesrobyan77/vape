import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { AccountOrderDetail } from "@/components/account/AccountPages";
import { AccountRoute, privateMetadata } from "@/components/account/AccountRoute";

type Props = { params: Promise<{ locale: Locale; number: string }> };

const ORDER_NUMBER = /^VH-\d{6}-[A-Z0-9]{6}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, number } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("orderDetail", { number: decodeURIComponent(number) }), ...privateMetadata };
}

export default async function AccountOrderPage({ params }: Props) {
  const { locale, number: raw } = await params;
  setRequestLocale(locale);
  const number = decodeURIComponent(raw);
  if (!ORDER_NUMBER.test(number)) notFound();
  const t = await getTranslations("account");
  return (
    <AccountRoute title={t("orderDetail", { number })} crumbs={[{ label: t("orders"), href: "/account/orders" }, { label: number }]}>
      <AccountOrderDetail number={number} />
    </AccountRoute>
  );
}
