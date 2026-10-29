"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import { useCart, useCartMutations, useCartQuote } from "@/hooks/use-cart";
import { useCheckoutPrefs } from "@/hooks/use-checkout-prefs";
import { useErrorMessage } from "@/hooks/use-error-message";
import { formatAmd } from "@/lib/money";
import type { CartLine } from "@/lib/api/types";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useToast } from "@/components/providers/Toaster";
import { ArrowRightIcon, TrashIcon } from "@/components/icons";
import { QuantityControl } from "@/components/ui/QuantityControl";
import { SafeImage } from "@/components/ui/SafeImage";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState, FormAlert } from "@/components/ui/States";
import { CartSummary } from "./CartSummary";

export function CartPageView() {
  const t = useTranslations("cart");
  const cart = useCart();
  const { prefs, update } = useCheckoutPrefs();
  const quote = useCartQuote(prefs.region, prefs.coupon, Boolean(cart.data?.items.length));
  const { clear } = useCartMutations();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [confirmClear, setConfirmClear] = useState(false);

  if (cart.isPending) return <CartSkeleton />;
  if (cart.isError) return <ErrorState message={`${t("loadError")} ${errorMessage(cart.error)}`} onRetry={() => cart.refetch()} retrying={cart.isFetching} />;

  const data = cart.data;
  if (data.items.length === 0) {
    return (
      <EmptyState
        title={t("emptyTitle")}
        body={t("emptyBody")}
        action={
          <Link href="/shop" className="cus-btn">
            {t("continueShopping")}
            <ArrowRightIcon />
          </Link>
        }
      />
    );
  }

  const totals = quote.data?.totals ?? data.totals;
  const coupon = quote.data?.coupon ?? null;
  const blocking = data.items.some((l) => l.status === "insufficient_stock");
  const purchasable = data.items.some((l) => l.status !== "out_of_stock" && l.status !== "unavailable");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        {data.issues.length > 0 ? (
          <div className="mb-24">
            <FormAlert tone="warning">
              <strong>{t("issuesTitle")}</strong>
            </FormAlert>
          </div>
        ) : null}

        {/* Desktop table (reference) */}
        <div className="surface mb-32 hidden p-6 pb-0 lg:block">
          <table className="cart-table" data-testid="cart-table">
            <thead>
              <tr>
                <th scope="col" className="h6">
                  {t("product")}
                </th>
                <th scope="col" className="h6">
                  {t("price")}
                </th>
                <th scope="col" className="h6">
                  {t("quantity")}
                </th>
                <th scope="col" className="h6">
                  {t("total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((line) => (
                <CartRow key={line.id} line={line} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile / tablet cards */}
        <ul className="mb-32 grid gap-4 sm:grid-cols-2 lg:hidden" data-testid="cart-cards">
          {data.items.map((line) => (
            <CartCard key={line.id} line={line} />
          ))}
        </ul>

        <div className="mb-64 flex flex-wrap items-center justify-between gap-4">
          <Link href="/shop" className="cus-btn">
            {t("continueShopping")}
            <ArrowRightIcon />
          </Link>
          <button type="button" className="text-link" onClick={() => setConfirmClear(true)} data-testid="clear-cart">
            {t("clearCart")}
          </button>
        </div>
      </div>

      <div>
        <CartSummary
          totals={totals}
          title={t("cartTotal")}
          updating={quote.isFetching}
          regionSlot={<RegionSelect value={prefs.region} onChange={(region) => update({ region })} />}
        >
          <CouponForm
            applied={coupon}
            onApply={(code) => update({ coupon: code })}
            onRemove={() => update({ coupon: undefined })}
            pending={quote.isFetching}
          />
          {blocking ? (
            <p className="mb-16 text-sm text-warning" role="status">
              {t("blockingIssue")}
            </p>
          ) : null}
          {blocking || !purchasable ? (
            <button type="button" className="cus-btn is-filled w-full" disabled>
              {t("proceed")}
              <ArrowRightIcon />
            </button>
          ) : (
            <Link href="/checkout" className="cus-btn is-filled w-full" data-testid="proceed-checkout">
              {t("proceed")}
              <ArrowRightIcon />
            </Link>
          )}
        </CartSummary>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title={t("clearConfirm")}
        confirmLabel={t("clearCart")}
        pending={clear.isPending}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() =>
          clear.mutate(undefined, {
            onSuccess: () => setConfirmClear(false),
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </div>
  );
}

function useLineActions(line: CartLine) {
  const t = useTranslations("cart");
  const { update, remove, pendingLines } = useCartMutations();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  return {
    pending: pendingLines.has(line.id),
    setQuantity: (quantity: number) =>
      update.mutate({ itemId: line.id, quantity }, { onError: (err) => toast.error(`${t("updateError")} ${errorMessage(err)}`) }),
    remove: () => remove.mutate({ itemId: line.id }, { onError: (err) => toast.error(errorMessage(err)) }),
  };
}

function LineStatus({ line }: { line: CartLine }) {
  const t = useTranslations("cart");
  if (line.status === "ok") return null;
  const text =
    line.status === "price_changed"
      ? t("status.price_changed", { from: formatAmd(line.previousUnitPrice ?? line.unitPrice), to: formatAmd(line.unitPrice) })
      : line.status === "insufficient_stock"
        ? t("status.insufficient_stock", { available: line.available })
        : t(`status.${line.status}`);
  const tone = line.status === "price_changed" ? "text-warning" : "text-danger";
  return (
    <p className={`mt-2 text-sm ${tone}`} data-testid="line-status" data-status={line.status}>
      {text}
    </p>
  );
}

function CartRow({ line }: { line: CartLine }) {
  const t = useTranslations("cart");
  const { pending, setQuantity, remove } = useLineActions(line);
  const unavailable = line.status === "out_of_stock" || line.status === "unavailable";
  return (
    <tr aria-busy={pending} data-testid="cart-line" className={unavailable ? "opacity-70" : undefined}>
      <td>
        <div className="flex items-center gap-[clamp(16px,1.25vw,32px)]">
          <button type="button" className="icon-btn hover:!text-primary-2" onClick={remove} disabled={pending} aria-label={t("remove", { name: line.name })}>
            {pending ? <span className="spinner" aria-hidden /> : <TrashIcon className="!h-5 !w-5" />}
          </button>
          <Link href={`/products/${line.slug}`} className="flex items-center gap-4 hover:text-primary-2">
            <span className="thumb h-20 w-20">
              <SafeImage image={line.image} width={80} height={80} decorative sizes="80px" />
            </span>
            <span>
              <span className="block text-white">{line.name}</span>
              {line.variantLabel ? <span className="block text-sm text-gray">{line.variantLabel}</span> : null}
            </span>
          </Link>
        </div>
        <LineStatus line={line} />
      </td>
      <td>{formatAmd(line.unitPrice)}</td>
      <td>
        {unavailable ? (
          "—"
        ) : (
          <div className="flex justify-center">
            <QuantityControl value={line.quantity} max={Math.max(line.available, 1)} disabled={pending} onChange={setQuantity} />
          </div>
        )}
      </td>
      <td data-testid="line-total">{unavailable ? "—" : formatAmd(line.lineTotal)}</td>
    </tr>
  );
}

function CartCard({ line }: { line: CartLine }) {
  const t = useTranslations("cart");
  const { pending, setQuantity, remove } = useLineActions(line);
  const unavailable = line.status === "out_of_stock" || line.status === "unavailable";
  return (
    <li className="surface relative p-4 text-center" aria-busy={pending} data-testid="cart-card">
      <button
        type="button"
        className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-primary text-white transition-colors hover:bg-white hover:text-primary"
        onClick={remove}
        disabled={pending}
        aria-label={t("remove", { name: line.name })}
      >
        {pending ? <span className="spinner" aria-hidden /> : <TrashIcon className="h-4 w-4" />}
      </button>
      <div className="mx-auto mb-16 w-24">
        <SafeImage image={line.image} width={96} height={96} decorative sizes="96px" />
      </div>
      <Link href={`/products/${line.slug}`} className="h5 mb-8 block text-white">
        {line.name}
      </Link>
      {line.variantLabel ? <p className="mb-16 text-sm">{line.variantLabel}</p> : null}
      <div className="summary-row mb-16">
        <span>{t("price")}:</span>
        <span>{formatAmd(line.unitPrice)}</span>
      </div>
      {!unavailable ? (
        <div className="summary-row mb-24">
          <span>{t("quantity")}:</span>
          <QuantityControl size="sm" value={line.quantity} max={Math.max(line.available, 1)} disabled={pending} onChange={setQuantity} />
        </div>
      ) : null}
      <hr className="dash-line mb-16" />
      <div className="summary-row">
        <span>{t("total")}:</span>
        <span>{unavailable ? "—" : formatAmd(line.lineTotal)}</span>
      </div>
      <LineStatus line={line} />
    </li>
  );
}

function RegionSelect({ value, onChange }: { value: string | undefined; onChange: (region: string) => void }) {
  const t = useTranslations("checkout");
  const settings = useSettings();
  const id = useId();
  if (!settings) return null;
  return (
    <div className="form-group mb-24">
      <label htmlFor={id} className="field-label text-sm">
        {t("region")}
      </label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} data-testid="cart-region">
        <option value="">{t("regionPlaceholder")}</option>
        {settings.regions.map((region) => (
          <option key={region.code} value={region.code}>
            {region.name}
          </option>
        ))}
      </select>
    </div>
  );
}

const COUPON_REASONS = ["not_found", "inactive", "not_started", "expired", "usage_limit", "min_subtotal"] as const;

export function CouponForm({
  applied,
  onApply,
  onRemove,
  pending,
}: {
  applied: { code: string; valid: boolean; reason?: string } | null;
  onApply: (code: string) => void;
  onRemove: () => void;
  pending?: boolean;
}) {
  const t = useTranslations("cart");
  const [code, setCode] = useState("");
  const id = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase().slice(0, 32);
    if (clean) onApply(clean);
  };
  const reason = applied && !applied.valid ? (COUPON_REASONS.find((r) => r === applied.reason) ?? "not_found") : null;
  return (
    <div className="mb-24">
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          {t("couponLabel")}
        </label>
        <span className="form-group">
          <input
            id={id}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("couponPlaceholder")}
            autoComplete="off"
            maxLength={32}
            data-testid="coupon-input"
          />
        </span>
        <button type="submit" className="cus-btn is-sm shrink-0" disabled={pending || !code.trim()}>
          {t("applyCoupon")}
        </button>
      </form>
      {applied ? (
        <p className={`mt-2 flex items-center gap-2 text-sm ${applied.valid ? "text-success" : "text-danger"}`} role="status" data-testid="coupon-status">
          {applied.valid ? t("couponApplied", { code: applied.code }) : t(`couponReasons.${reason ?? "not_found"}`)}
          <button type="button" className="text-link ml-auto text-white" onClick={onRemove}>
            {t("removeCoupon")}
          </button>
        </p>
      ) : null}
    </div>
  );
}

function CartSkeleton() {
  const t = useTranslations("common");
  return (
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]" aria-busy="true" aria-label={t("loading")} data-testid="cart-skeleton">
      <div className="surface space-y-6 p-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="skeleton h-20 w-20" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-1/4" />
            </div>
            <div className="skeleton h-10 w-28" />
          </div>
        ))}
      </div>
      <div className="surface space-y-4 p-6">
        <div className="skeleton h-12 w-full" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-6 w-2/3" />
      </div>
    </div>
  );
}
