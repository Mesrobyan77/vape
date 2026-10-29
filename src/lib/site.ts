import { LOCALES, type Locale } from "./api/types";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Absolute URL for a locale-prefixed path ("/" → "/hy"). */
export function localizedUrl(locale: Locale, path: string): string {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}/${locale}${clean}`;
}

/** `alternates` block (canonical + hreflang) for Next metadata. */
export function alternatesFor(locale: Locale, path: string) {
  return {
    canonical: localizedUrl(locale, path),
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, localizedUrl(l, path)])),
      "x-default": localizedUrl("hy", path),
    },
  };
}
