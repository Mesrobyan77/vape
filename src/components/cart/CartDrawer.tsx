"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useCart, useCartMutations } from "@/hooks/use-cart";
import { useDialog } from "@/hooks/use-dialog";
import { useErrorMessage } from "@/hooks/use-error-message";
import { formatAmd } from "@/lib/money";
import type { CartLine } from "@/lib/api/types";
import { useUi } from "@/components/providers/UiState";
import { useToast } from "@/components/providers/Toaster";
import { ArrowRightIcon, TrashIcon } from "@/components/icons";
import { QuantityControl } from "@/components/ui/QuantityControl";
import { ErrorState } from "@/components/ui/States";

export function CartDrawer() {
  const { panel, close } = useUi();
  const pathname = usePathname();
  // Navigating away (e.g. "View Cart") closes the drawer.
  useEffect(() => close(), [pathname, close]);
  return (
    <AnimatePresence>
      {panel === "cart" ? (
        <>
          <motion.div
            key="curtain"
            className="fixed inset-0 z-[1000] bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={close}
            aria-hidden
          />
          <DrawerPanel key="panel" onClose={close} />
        </>
      ) : null}
    </AnimatePresence>
  );
}

function DrawerPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("cart");
  const tCommon = useTranslations("common");
  const ref = useRef<HTMLDivElement>(null);
  const cart = useCart();
  useDialog(ref, true, onClose);
  const count = cart.data?.totals.itemCount ?? 0;

  return (
    <motion.aside
      id="cart-drawer"
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
      className="drawer-panel sidebar-cart"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      data-testid="cart-drawer"
    >
      <div className="mb-24 flex items-center justify-between">
        <h2 id="cart-drawer-title" className="h5 text-white">
          {t("drawerTitle", { count })}
        </h2>
        <button
          type="button"
          className="icon-btn transition-transform duration-500 hover:rotate-[135deg]"
          onClick={onClose}
          aria-label={tCommon("close")}
        >
          <X className="!h-8 !w-8" aria-hidden />
        </button>
      </div>

      {cart.isPending ? (
        <ul className="sidebar-cart__list" aria-busy="true" aria-label={tCommon("loading")}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="mb-24 flex gap-4">
              <div className="skeleton h-[108px] w-[100px]" />
              <div className="flex-1 space-y-3 pt-2">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-4 w-1/4" />
              </div>
            </li>
          ))}
        </ul>
      ) : cart.isError ? (
        <div className="flex-1">
          <ErrorState message={t("loadError")} onRetry={() => cart.refetch()} retrying={cart.isFetching} />
        </div>
      ) : cart.data.items.length === 0 ? (
        <div className="flex flex-1 flex-col items-start gap-4">
          <p className="lead text-white">{t("emptyTitle")}</p>
          <p>{t("emptyBody")}</p>
          <Link href="/shop" className="cus-btn" onClick={onClose}>
            {t("continueShopping")}
            <ArrowRightIcon />
          </Link>
        </div>
      ) : (
        <>
          <ul className="sidebar-cart__list" data-testid="cart-drawer-items">
            {cart.data.items.map((line) => (
              <DrawerLine key={line.id} line={line} onNavigate={onClose} />
            ))}
          </ul>
          <div className="pt-4">
            <div className="summary-row mb-8">
              <span className="h6">{t("total")}:</span>
              <span className="h6" data-testid="cart-drawer-total">
                {formatAmd(cart.data.totals.subtotal - cart.data.totals.discount)}
              </span>
            </div>
            <p className="mb-24 text-sm">
              {cart.data.totals.amountToFreeShipping > 0
                ? t("freeShippingProgress", { amount: formatAmd(cart.data.totals.amountToFreeShipping) })
                : t("freeShippingReached")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/cart" className="cus-btn w-full" onClick={onClose}>
                {t("viewCart")}
                <ArrowRightIcon />
              </Link>
              <Link href="/checkout" className="cus-btn is-filled w-full" onClick={onClose}>
                {t("checkout")}
                <ArrowRightIcon />
              </Link>
            </div>
          </div>
        </>
      )}
    </motion.aside>
  );
}

function DrawerLine({ line, onNavigate }: { line: CartLine; onNavigate: () => void }) {
  const t = useTranslations("cart");
  const { update, remove, pendingLines } = useCartMutations();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const pending = pendingLines.has(line.id);
  const unavailable = line.status === "out_of_stock" || line.status === "unavailable";

  return (
    <li className="mb-24 flex items-start justify-between gap-3" data-testid="cart-drawer-line" aria-busy={pending}>
      <div className="flex gap-4">
        <Link href={`/products/${line.slug}`} className="thumb h-[108px] w-[100px]" onClick={onNavigate} tabIndex={-1} aria-hidden>
          {line.image ? <Image src={line.image.url} alt="" width={100} height={108} className="h-full w-full object-contain" /> : null}
        </Link>
        <div className="min-w-0">
          <Link href={`/products/${line.slug}`} className="h6 mb-8 block text-white hover:text-primary-2" onClick={onNavigate}>
            {line.name}
          </Link>
          {line.variantLabel ? <p className="mb-8 text-sm">{line.variantLabel}</p> : null}
          <p className="lead mb-8 text-white">{formatAmd(line.unitPrice)}</p>
          {unavailable ? (
            <p className="text-sm text-danger">{t(`status.${line.status}`)}</p>
          ) : (
            <QuantityControl
              size="sm"
              value={line.quantity}
              max={Math.max(line.available, line.quantity)}
              disabled={pending}
              onChange={(quantity) =>
                update.mutate({ itemId: line.id, quantity }, { onError: (err) => toast.error(errorMessage(err)) })
              }
            />
          )}
        </div>
      </div>
      <button
        type="button"
        className="icon-btn !text-gray hover:!text-primary-2"
        onClick={() => remove.mutate({ itemId: line.id }, { onError: (err) => toast.error(errorMessage(err)) })}
        disabled={pending}
        aria-label={t("remove", { name: line.name })}
      >
        {pending ? <span className="spinner" aria-hidden /> : <TrashIcon className="!h-5 !w-5" />}
      </button>
    </li>
  );
}
