import { z } from "zod";
import { DEFAULT_LOCALE, LOCALES, type Locale, type Localized } from "@/lib/api/types";

export const localeSchema = z.enum(LOCALES);

export function parseLocale(value: unknown): Locale {
  const parsed = localeSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_LOCALE;
}

/** Resolves a localized value with fallback to Armenian, then any available value. */
export function tr(value: Partial<Localized> | null | undefined, locale: Locale): string {
  if (!value) return "";
  return value[locale]?.trim() || value.hy?.trim() || value.en?.trim() || value.ru?.trim() || "";
}

export const emptyLocalized = (): Localized => ({ hy: "", ru: "", en: "" });

export const localizedInput = (opts: { max: number; requiredHy?: boolean }) =>
  z
    .object({
      hy: opts.requiredHy === false ? z.string().trim().max(opts.max).default("") : z.string().trim().min(1).max(opts.max),
      ru: z.string().trim().max(opts.max).default(""),
      en: z.string().trim().max(opts.max).default(""),
    })
    .strict();
