import "../globals.css";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/api/types";
import { AGE_COOKIE } from "@/lib/compliance";
import { safely } from "@/lib/safe";
import { SITE_URL, alternatesFor } from "@/lib/site";
import { getPublicSettings } from "@/server/storefront";
import { fontVariables } from "../fonts";
import { AppProviders } from "@/components/providers/AppProviders";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import { SearchOverlay } from "@/components/layout/SearchOverlay";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Preloader } from "@/components/effects/Preloader";
import { CursorTrail } from "@/components/effects/CursorTrail";
import { ScrollTop } from "@/components/effects/ScrollTop";
import { AgeGate } from "@/components/compliance/AgeGate";

export const viewport: Viewport = {
  themeColor: "#0c0c0d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("defaultTitle"), template: t("titleTemplate") },
    description: t("defaultDescription"),
    applicationName: t("siteName"),
    alternates: alternatesFor(locale, "/"),
    openGraph: { siteName: t("siteName"), locale, type: "website" },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [cookieStore, settings, t] = await Promise.all([
    cookies(),
    safely(() => getPublicSettings(locale as Locale)),
    getTranslations({ locale, namespace: "common" }),
  ]);
  const ageConfirmed = cookieStore.get(AGE_COOKIE)?.value === "1";
  const publicSettings = settings.ok ? settings.data : null;

  return (
    <html lang={locale} data-scroll-behavior="smooth" className={fontVariables} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NextIntlClientProvider>
          <AppProviders>
            <SettingsProvider settings={publicSettings}>
              <a href="#main" className="skip-link sr-only-focusable">
                {t("skipToContent")}
              </a>
              <Preloader />
              <CursorTrail />
              <div className="relative z-[1] flex min-h-screen flex-col">
                <Header />
                <main id="main" tabIndex={-1} className="flex-1 outline-none">
                  {children}
                </main>
                <Footer settings={publicSettings} />
              </div>
              <CartDrawer />
              <SearchOverlay />
              <MobileNav />
              <ScrollTop />
              <AgeGate initiallyConfirmed={ageConfirmed} />
            </SettingsProvider>
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
