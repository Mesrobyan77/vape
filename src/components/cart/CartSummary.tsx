"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Totals } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";

/** Totals block shared by the cart page and checkout. All numbers come from the server. */
export function CartSummary({
  totals,
  title,
  children,
  regionSlot,
  updating,
}: {
  totals: Totals;
  title: string;
  children?: ReactNode;
  regionSlot?: ReactNode;
  updating?: boolean;
}) {
  const t = useTranslations("cart");
  return (
    <div className="surface p-4 sm:p-6" aria-busy={updating} data-testid="cart-summary">
      <h2 className="h5 panel-title mb-32">{title}</h2>
      <dl className={`transition-opacity ${updating ? "opacity-60" : ""}`}>
        <div className="summary-row mb-16">
          <dt>{t("subtotal")}</dt>
          <dd data-testid="summary-subtotal">{formatAmd(totals.subtotal)}</dd>
        </div>
        {totals.discount > 0 ? (
          <div className="summary-row mb-16">
            <dt>{t("discount")}</dt>
            <dd data-testid="summary-discount">−{formatAmd(totals.discount)}</dd>
          </div>
        ) : null}
        <div className="summary-row mb-16">
          <dt>{totals.shippingEstimated ? t("deliveryEstimated") : t("delivery")}</dt>
          <dd data-testid="summary-shipping">{totals.shipping === 0 ? t("free") : formatAmd(totals.shipping)}</dd>
        </div>
        {regionSlot}
        <hr className="dash-line mb-24" />
        <div className="summary-row mb-8">
          <dt className="h5">{t("grandTotal")}</dt>
          <dd className="h5" data-testid="summary-total">
            {formatAmd(totals.total)}
          </dd>
        </div>
        <div className="summary-row mb-24 text-sm !text-gray">
          <dt>{t("vatIncluded", { rate: totals.vatRatePercent })}</dt>
          <dd data-testid="summary-vat">{formatAmd(totals.vatAmount)}</dd>
        </div>
      </dl>
      <p className="mb-24 text-sm" data-testid="free-shipping-progress">
        {totals.amountToFreeShipping > 0
          ? t("freeShippingProgress", { amount: formatAmd(totals.amountToFreeShipping) })
          : t("freeShippingReached")}
      </p>
      {children}
    </div>
  );
}
