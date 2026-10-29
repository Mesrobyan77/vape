"use client";

import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALES, type Locale } from "@/lib/api/types";
import { useOutsideClick } from "@/hooks/use-dialog";

const SHORT: Record<Locale, string> = { hy: "ՀԱՅ", ru: "РУС", en: "ENG" };

export function LanguageSwitcher({ variant = "header" }: { variant?: "header" | "mobile" }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [wrapperRef], []);
  const [lastPath, setLastPath] = useState(pathname);
  useOutsideClick(refs, open, () => setOpen(false));

  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const query = Object.fromEntries(searchParams.entries());
  const links = LOCALES.map((l) => (
    <li key={l}>
      <Link
        href={{ pathname, query }}
        locale={l}
        hrefLang={l}
        lang={l}
        aria-current={l === locale ? "true" : undefined}
        onClick={() => setOpen(false)}
        data-testid={`lang-${l}`}
      >
        <span>{t(`languages.${l}`)}</span>
        <span aria-hidden className="opacity-70">
          {l.toUpperCase()}
        </span>
      </Link>
    </li>
  ));

  if (variant === "mobile") {
    return (
      <div>
        <p className="mb-2 text-sm font-semibold text-white">{t("nav.language")}</p>
        <ul className="lang-switch__menu !static !min-w-0">{links}</ul>
      </div>
    );
  }

  return (
    <div className="lang-switch" ref={wrapperRef} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        className="lang-switch__button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("nav.currentLanguage", { language: t(`languages.${locale}`) })}
        onClick={() => setOpen((v) => !v)}
        data-testid="language-switcher"
      >
        {SHORT[locale]}
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <ul id={menuId} className="lang-switch__menu">
          {links}
        </ul>
      ) : null}
    </div>
  );
}
