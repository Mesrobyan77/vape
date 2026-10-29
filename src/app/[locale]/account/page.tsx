import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccountHome } from "@/components/account/AccountPages";
import { privateMetadata } from "@/components/account/AccountRoute";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("title"), ...privateMetadata };
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");
  return (
    <>
      <PageHeader title={t("title")} crumbs={[{ label: t("title") }]} />
      <section className="py-80">
        <div className="container-vh">
          <AccountHome />
        </div>
      </section>
    </>
  );
}
