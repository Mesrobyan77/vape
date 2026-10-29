import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { alternatesFor } from "@/lib/site";
import { LegalPage } from "@/components/content/LegalPage";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("privacy.title"), alternates: alternatesFor(locale, "/privacy") };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage doc="privacy" sections={["collect", "use", "share", "rights"]} />;
}
