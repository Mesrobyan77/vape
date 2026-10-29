"use client";

import Image from "next/image";
import { ChevronDown, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useCart } from "@/hooks/use-cart";
import { useOutsideClick } from "@/hooks/use-dialog";
import { useUi } from "@/components/providers/UiState";
import { CartIcon, SearchIcon, UserIcon } from "@/components/icons";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { media } from "@/lib/media";

const SHOP_LINKS = [
  { href: "/shop", key: "shopGrid" },
  { href: "/shop/sidebar", key: "shopSidebar" },
] as const;

export function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { toggle, open: openPanel, panel } = useUi();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isShop = pathname === "/shop" || pathname.startsWith("/shop/");

  return (
    <header className={`main-menu ${scrolled ? "is-scrolled" : ""}`} data-testid="site-header">
      <div className="container-vh">
        <div className="main-menu__block">
          <div className="main-menu__logo">
            <Link href="/" aria-label="Vape Hub — home">
              <Image src={media("logo.png")} alt="Vape Hub" width={229} height={48} priority />
            </Link>
          </div>

          <nav aria-label={t("main")} className="main-menu__nav mx-auto">
            <ul className="main-menu__list">
              <li>
                <Link href="/" className="main-menu__link" aria-current={pathname === "/" ? "page" : undefined}>
                  {t("home")}
                </Link>
              </li>
              <li className={isShop ? "is-current" : undefined}>
                <ShopDropdown label={t("shop")} pathname={pathname} />
              </li>
              <li>
                <Link href="/about" className="main-menu__link" aria-current={pathname === "/about" ? "page" : undefined}>
                  {t("about")}
                </Link>
              </li>
            </ul>
          </nav>

          <div className="main-menu__right">
            <button
              type="button"
              className="icon-btn"
              aria-label={t("search")}
              aria-expanded={panel === "search"}
              aria-controls="search-overlay"
              onClick={() => toggle("search")}
              data-testid="open-search"
            >
              <SearchIcon />
            </button>
            <Suspense fallback={<span className="lang-switch__button" aria-hidden>··</span>}>
              <LanguageSwitcher />
            </Suspense>
            <Link
              href="/account"
              className="icon-btn"
              aria-label={t("account")}
              aria-current={pathname.startsWith("/account") ? "page" : undefined}
            >
              <UserIcon />
            </Link>
            <CartButton onOpen={() => openPanel("cart")} expanded={panel === "cart"} />
            <button
              type="button"
              className="icon-btn xl:!hidden"
              aria-label={t("openMenu")}
              aria-expanded={panel === "menu"}
              aria-controls="mobile-nav"
              onClick={() => toggle("menu")}
              data-testid="open-menu"
            >
              <Menu className="!h-7 !w-7 text-primary-2" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function ShopDropdown({ label, pathname }: { label: string; pathname: string }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const refs = useMemo(() => [wrapperRef], []);
  const [lastPath, setLastPath] = useState(pathname);

  useOutsideClick(refs, open, () => setOpen(false));

  // Close on navigation (adjusting state during render, not in an effect).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const focusItem = (index: number) => {
    const items = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    if (items.length === 0) return;
    items[(index + items.length) % items.length]?.focus();
  };

  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(0));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const onMenuKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    const index = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(index - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        className="main-menu__link"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKey}
        data-testid="shop-menu-button"
      >
        {label}
        <ChevronDown aria-hidden />
      </button>
      <ul id={menuId} className={`sub-menu ${open ? "is-open" : ""}`} onKeyDown={onMenuKey} data-testid="shop-menu">
        {SHOP_LINKS.map((link, i) => (
          <li key={link.href}>
            <Link
              href={link.href}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              tabIndex={open ? 0 : -1}
              aria-current={pathname === link.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {t(link.key)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CartButton({ onOpen, expanded }: { onOpen: () => void; expanded: boolean }) {
  const t = useTranslations("nav");
  const cart = useCart();
  const count = cart.data?.totals.itemCount;
  // A failed request must not masquerade as an empty cart.
  const label = cart.isError ? t("cartUnknown") : count === undefined ? t("openCart") : t("cartCount", { count });
  return (
    <button
      type="button"
      className="icon-btn relative"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls="cart-drawer"
      onClick={onOpen}
      data-testid="open-cart"
    >
      <CartIcon />
      {cart.isError ? (
        <span className="cart-count" aria-hidden>
          !
        </span>
      ) : count ? (
        <span className="cart-count" aria-hidden data-testid="cart-count">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}
