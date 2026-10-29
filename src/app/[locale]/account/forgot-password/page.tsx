import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { ForgotPasswordForm } from "@/components/account/AuthForms";
import { AuthPanel } from "@/components/account/AccountShell";
import { AccountRoute, privateMetadata } from "@/components/account/AccountRoute";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("forgotTitle"), ...privateMetadata };
}

export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");
  return (
    <AccountRoute title={t("forgotTitle")} crumbs={[{ label: t("forgotTitle") }]}>
      <div className="mx-auto max-w-[560px]">
        <AuthPanel title={t("forgotTitle")}>
          <ForgotPasswordForm />
        </AuthPanel>
      </div>
    </AccountRoute>
  );
}
