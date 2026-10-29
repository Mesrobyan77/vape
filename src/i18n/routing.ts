import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/api/types";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  // Armenian is the default for everyone; a language is only changed by explicit choice.
  localeDetection: false,
  localeCookie: { name: "vh_locale", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" },
});
