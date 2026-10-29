import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { ResetPasswordForm } from "@/components/account/AuthForms";
import { AuthPanel } from "@/components/account/AccountShell";
import { AccountRoute } from "@/components/account/AccountRoute";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ token?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  // The token travels in the URL: never index, never leak it via the Referer header.
  return { title: t("resetTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = (await searchParams).token;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const token = value && /^[A-Za-z0-9_-]{20,200}$/.test(value) ? value : null;
  const t = await getTranslations("account");
  return (
    <AccountRoute title={t("resetTitle")} crumbs={[{ label: t("resetTitle") }]}>
      <div className="mx-auto max-w-[560px]">
        <AuthPanel title={t("resetTitle")}>
          <ResetPasswordForm token={token} />
        </AuthPanel>
      </div>
    </AccountRoute>
  );
}
