"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Mail, Phone, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useDialog } from "@/hooks/use-dialog";
import { useUi } from "@/components/providers/UiState";
import { useSettings } from "@/components/providers/SettingsProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function MobileNav() {
  const { panel, close } = useUi();
  const pathname = usePathname();
  useEffect(() => close(), [pathname, close]);
  return (
    <AnimatePresence>
      {panel === "menu" ? (
        <>
          <motion.div
            key="overlay"
            className="mobile-nav__overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={close}
            aria-hidden
          />
          <Panel key="panel" onClose={close} />
        </>
      ) : null}
    </AnimatePresence>
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const settings = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  const [shopOpen, setShopOpen] = useState(pathname.startsWith("/shop"));
  const subId = useId();
  useDialog(ref, true, onClose);

  const link = (href: string, label: string) => (
    <li>
      <Link href={href} aria-current={pathname === href ? "page" : undefined}>
        {label}
      </Link>
    </li>
  );

  return (
    <motion.nav
      id="mobile-nav"
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={t("main")}
      className="mobile-nav__content"
      initial={{ x: "-100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "-100%", opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      data-testid="mobile-nav"
    >
      <button type="button" onClick={onClose} className="icon-btn absolute right-3 top-3" aria-label={t("closeMenu")}>
        <X className="!h-6 !w-6" aria-hidden />
      </button>
      <div className="mb-10 flex">
        <Link href="/" aria-label="Vape Hub — home">
          <Image src="/media/logo.png" alt="Vape Hub" width={190} height={40} />
        </Link>
      </div>
      <ul className="mobile-nav__list">
        {link("/", t("home"))}
        <li>
          <button
            type="button"
            className="mobile-nav__toggle"
            aria-expanded={shopOpen}
            aria-controls={subId}
            onClick={() => setShopOpen((v) => !v)}
          >
            {t("shop")}
            <span className="chev" aria-hidden>
              <ChevronDown className="h-4 w-4" />
            </span>
          </button>
          {shopOpen ? (
            <ul id={subId} className="mobile-nav__sub">
              {link("/shop", t("shopGrid"))}
              {link("/shop/sidebar", t("shopSidebar"))}
            </ul>
          ) : null}
        </li>
        {link("/about", t("about"))}
        {link("/blog", t("blog"))}
        {link("/contact", t("contact"))}
        {link("/faq", t("faq"))}
        {link("/account", t("account"))}
        {link("/cart", t("cart"))}
      </ul>
      <div className="mt-6">
        <Suspense fallback={null}>
          <LanguageSwitcher variant="mobile" />
        </Suspense>
      </div>
      {settings ? (
        <ul className="mobile-nav__contact">
          <li>
            <span className="ico" aria-hidden>
              <Mail className="h-4 w-4" />
            </span>
            <a href={`mailto:${settings.store.email}`}>{settings.store.email}</a>
          </li>
          <li>
            <span className="ico" aria-hidden>
              <Phone className="h-4 w-4" />
            </span>
            <a href={`tel:${settings.store.phone.replace(/\s+/g, "")}`}>{settings.store.phone}</a>
          </li>
        </ul>
      ) : null}
    </motion.nav>
  );
}
