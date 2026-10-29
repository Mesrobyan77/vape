"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { Link, useRouter } from "@/i18n/navigation";
import { api, isApiError, newIdempotencyKey } from "@/lib/api/client";
import type { Address, Cart, CheckoutRequest, CheckoutResponse, Locale, PaymentMethod } from "@/lib/api/types";
import { checkoutSchema, fieldForApiPath, normalizeArmenianPhone, type CheckoutFormValues } from "@/lib/checkout-schema";
import { formatAmd } from "@/lib/money";
import { useCart, useCartQuote } from "@/hooks/use-cart";
import { useCheckoutPrefs } from "@/hooks/use-checkout-prefs";
import { useMe } from "@/hooks/use-me";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useSettings } from "@/components/providers/SettingsProvider";
import { requestAgeConfirmation } from "@/components/compliance/AgeGate";
import { ArrowRightIcon } from "@/components/icons";
import { CartSummary } from "@/components/cart/CartSummary";
import { CouponForm } from "@/components/cart/CartPageView";
import { EmptyState, ErrorState, FormAlert } from "@/components/ui/States";
import { Field, CheckboxField } from "@/components/forms/Field";

type Stage = "idle" | "validating" | "submitting" | "redirecting" | "recovering";

const PENDING_KEY = "vh_pending_checkout";
const METHOD_ORDER: PaymentMethod[] = ["cod", "idram", "arca", "mock"];

interface PendingCheckout {
  key: string;
  payloadHash: string;
}

function hashPayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  let h = 0;
  for (let i = 0; i < json.length; i += 1) h = (Math.imul(31, h) + json.charCodeAt(i)) | 0;
  return String(h);
}

function readPending(): PendingCheckout | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingCheckout) : null;
  } catch {
    return null;
  }
}

function writePending(value: PendingCheckout | null) {
  try {
    if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore storage failures; the in-memory key still protects this page instance
  }
}

/** Submits the provider's redirect (Idram uses an auto-posted form). */
function followRedirect(redirect: NonNullable<CheckoutResponse["payment"]["redirect"]>) {
  if (redirect.method === "GET") {
    window.location.assign(redirect.url);
    return;
  }
  const form = document.createElement("form");
  form.method = "POST";
  form.action = redirect.url;
  for (const [name, value] of Object.entries(redirect.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function CheckoutView() {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const tv = useTranslations("validation");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const client = useQueryClient();
  const settings = useSettings();
  const me = useMe();
  const cart = useCart();
  const { prefs, update } = useCheckoutPrefs();
  const errorMessage = useErrorMessage();
  const [stage, setStage] = useState<Stage>("idle");
  const [alert, setAlert] = useState<{ tone: "error" | "warning" | "info"; text: string; retry?: boolean } | null>(null);
  const submitting = useRef(false);
  const lastPayload = useRef<CheckoutRequest | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const regions = useMemo(() => settings?.regions ?? [], [settings]);
  const methods = useMemo(
    () =>
      METHOD_ORDER.map((method) => ({ method, enabled: settings?.paymentMethods.find((m) => m.method === method)?.enabled ?? method === "cod" })).filter(
        (m) => m.method !== "mock" || m.enabled,
      ),
    [settings],
  );

  const schema = useMemo(
    () =>
      checkoutSchema(
        {
          required: tv("required"),
          email: tv("email"),
          phone: tv("phone"),
          max: (max) => tv("max", { max }),
          region: tv("region"),
          ageRequired: tv("ageRequired"),
          termsRequired: tv("termsRequired"),
        },
        regions.map((r) => r.code),
      ),
    [tv, regions],
  );

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      region: "",
      city: "",
      line1: "",
      line2: "",
      notes: "",
      paymentMethod: "cod",
      ageConfirmed: false,
      termsAccepted: false,
      saveAddress: false,
    },
  });
  const { register, handleSubmit, setValue, setError, setFocus, formState, control } = form;
  const region = useWatch({ control, name: "region" });
  const quote = useCartQuote(region || prefs.region, prefs.coupon, Boolean(cart.data?.items.length));

  const user = me.data?.user ?? null;
  const addresses = useQuery({
    queryKey: ["addresses"],
    queryFn: ({ signal }) => api<Address[]>("/account/addresses", { signal }),
    enabled: Boolean(user),
  });

  // Prefill from the account and the region picked on the cart page.
  useEffect(() => {
    if (!user) return;
    const [first, ...rest] = user.name.split(" ");
    if (!form.getValues("firstName")) setValue("firstName", first ?? "");
    if (!form.getValues("lastName")) setValue("lastName", rest.join(" "));
    if (!form.getValues("email")) setValue("email", user.email);
    if (!form.getValues("phone") && user.phone) setValue("phone", user.phone);
  }, [user, form, setValue]);

  useEffect(() => {
    if (prefs.region && !form.getValues("region")) setValue("region", prefs.region);
  }, [prefs.region, form, setValue]);

  useEffect(() => {
    if (region) update({ region });
  }, [region, update]);

  const applyAddress = (address: Address) => {
    const [first, ...rest] = address.fullName.split(" ");
    setValue("firstName", first ?? "", { shouldValidate: true });
    setValue("lastName", rest.join(" "), { shouldValidate: true });
    setValue("phone", address.phone, { shouldValidate: true });
    setValue("region", address.region, { shouldValidate: true });
    setValue("city", address.city, { shouldValidate: true });
    setValue("line1", address.line1, { shouldValidate: true });
    setValue("line2", address.line2);
    setValue("notes", address.notes);
  };

  const showAlert = (value: typeof alert) => {
    setAlert(value);
    requestAnimationFrame(() => alertRef.current?.focus());
  };

  const send = async (payload: CheckoutRequest): Promise<void> => {
    const payloadHash = hashPayload(payload);
    const existing = readPending();
    const key = existing && existing.payloadHash === payloadHash ? existing.key : newIdempotencyKey();
    writePending({ key, payloadHash });
    lastPayload.current = payload;

    setStage("submitting");
    try {
      const result = await api<CheckoutResponse>("/orders", { method: "POST", body: payload, idempotencyKey: key, timeoutMs: 30_000 });
      writePending(null);
      await client.invalidateQueries({ queryKey: ["cart"] });
      void client.invalidateQueries({ queryKey: ["orders"] });
      if (result.payment.redirect) {
        setStage("redirecting");
        followRedirect(result.payment.redirect);
        return;
      }
      router.push(`/checkout/success?order=${encodeURIComponent(result.order.number)}`);
    } catch (err) {
      setStage("idle");
      if (!isApiError(err)) {
        showAlert({ tone: "error", text: errorMessage(err) });
        return;
      }
      switch (err.code) {
        case "NETWORK":
        case "TIMEOUT":
          // Outcome unknown: keep the same idempotency key so a retry cannot create a second order.
          showAlert({ tone: "warning", text: t("networkUncertain"), retry: true });
          return;
        case "IDEMPOTENCY_IN_PROGRESS":
          setStage("recovering");
          showAlert({ tone: "info", text: t("inProgress") });
          window.setTimeout(() => void send(payload), 2000);
          return;
        case "IDEMPOTENCY_KEY_REUSED":
          writePending(null);
          showAlert({ tone: "error", text: t("idempotencyConflict") });
          return;
        case "OUT_OF_STOCK":
          writePending(null);
          await client.invalidateQueries({ queryKey: ["cart"] });
          showAlert({ tone: "error", text: t("stockConflict") });
          return;
        case "CART_EMPTY":
          writePending(null);
          showAlert({ tone: "error", text: t("emptyCart") });
          return;
        case "AGE_CONFIRMATION_REQUIRED":
          requestAgeConfirmation();
          showAlert({ tone: "error", text: errorMessage(err) });
          return;
        case "PAYMENT_PROVIDER_UNAVAILABLE":
          showAlert({ tone: "error", text: t("paymentUnavailable") });
          return;
        case "VALIDATION_FAILED": {
          writePending(null);
          let focused = false;
          for (const detail of err.fieldErrors) {
            const field = fieldForApiPath(detail.path);
            if (!field) continue;
            setError(field, { type: "server", message: detail.message ?? tv("invalid") });
            if (!focused) {
              setFocus(field as FieldPath<CheckoutFormValues>);
              focused = true;
            }
          }
          showAlert({ tone: "error", text: t("invalid") });
          return;
        }
        default:
          showAlert({ tone: "error", text: errorMessage(err) });
      }
    }
  };

  const onValid = async (values: CheckoutFormValues) => {
      if (submitting.current) return;
      submitting.current = true;
      setAlert(null);
      try {
        // 1. Re-validate the cart against live stock and prices before committing.
        setStage("validating");
        const freshCart = await client.fetchQuery({
          queryKey: ["cart", locale, "quote", values.region, prefs.coupon ?? ""],
          queryFn: () => api<Cart>("/cart", { query: { locale, region: values.region, coupon: prefs.coupon } }),
          staleTime: 0,
        });
        if (freshCart.items.length === 0) {
          setStage("idle");
          showAlert({ tone: "error", text: t("emptyCart") });
          return;
        }
        if (freshCart.items.some((l) => l.status === "insufficient_stock" || l.status === "out_of_stock" || l.status === "unavailable")) {
          await client.invalidateQueries({ queryKey: ["cart"] });
          setStage("idle");
          showAlert({ tone: "error", text: t("stockConflict") });
          return;
        }
        // 2. Place the order. Prices are never sent — the server recomputes everything.
        await send({
          customer: {
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            email: values.email.trim(),
            phone: normalizeArmenianPhone(values.phone) ?? values.phone,
          },
          shipping: { region: values.region, city: values.city.trim(), line1: values.line1.trim(), line2: values.line2.trim(), notes: values.notes.trim() },
          paymentMethod: values.paymentMethod,
          couponCode: prefs.coupon || undefined,
          ageConfirmed: true,
          termsAccepted: true,
          locale,
          saveAddress: Boolean(user) && values.saveAddress,
        });
      } catch (err) {
        setStage("idle");
        showAlert({ tone: "error", text: errorMessage(err) });
      } finally {
        submitting.current = false;
      }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    void handleSubmit(onValid, () => showAlert({ tone: "error", text: t("invalid") }))(event);
  };

  const retrySafely = () => {
    if (lastPayload.current && !submitting.current) {
      submitting.current = true;
      setAlert(null);
      void send(lastPayload.current).finally(() => {
        submitting.current = false;
      });
    }
  };

  if (cart.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]" aria-busy="true" data-testid="checkout-skeleton">
        <div className="skeleton h-[640px]" />
        <div className="skeleton h-[420px]" />
      </div>
    );
  }
  if (cart.isError) return <ErrorState message={errorMessage(cart.error)} onRetry={() => cart.refetch()} retrying={cart.isFetching} />;
  if (cart.data.items.length === 0 && stage === "idle") {
    return (
      <EmptyState
        title={t("emptyCart")}
        action={
          <Link href="/shop" className="cus-btn">
            {tCart("continueShopping")}
            <ArrowRightIcon />
          </Link>
        }
      />
    );
  }

  const totals = quote.data?.totals ?? cart.data.totals;
  const busy = stage !== "idle";
  const stageText =
    stage === "validating"
      ? t("steps.validating")
      : stage === "submitting"
        ? t("steps.submitting")
        : stage === "redirecting"
          ? t("steps.redirecting")
          : stage === "recovering"
            ? t("steps.recovering")
            : "";

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" data-testid="checkout-form" aria-busy={busy}>
      <div className="surface min-w-0 p-4 sm:p-6">
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          {alert ? (
            <div className="mb-24">
              <FormAlert tone={alert.tone}>
                <div className="flex flex-wrap items-center gap-3">
                  <span>{alert.text}</span>
                  {alert.retry ? (
                    <button type="button" className="cus-btn is-sm" onClick={retrySafely} data-testid="retry-checkout">
                      {t("retrySafe")}
                    </button>
                  ) : null}
                  {alert.tone === "error" && !alert.retry ? (
                    <Link href="/cart" className="text-link">
                      {tCart("viewCart")}
                    </Link>
                  ) : null}
                </div>
              </FormAlert>
            </div>
          ) : null}
        </div>

        <fieldset disabled={busy} className="min-w-0">
          <legend className="h6 panel-title mb-32 w-full">{t("contactDetails")}</legend>
          <div className="mb-32 grid gap-4 sm:grid-cols-2 lg:gap-6">
            <Field label={t("firstName")} error={formState.errors.firstName?.message} {...register("firstName")} autoComplete="given-name" />
            <Field label={t("lastName")} error={formState.errors.lastName?.message} {...register("lastName")} autoComplete="family-name" />
            <Field label={t("email")} type="email" error={formState.errors.email?.message} {...register("email")} autoComplete="email" />
            <Field
              label={t("phone")}
              type="tel"
              hint={t("phoneHint")}
              error={formState.errors.phone?.message}
              {...register("phone")}
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
        </fieldset>

        <fieldset disabled={busy} className="min-w-0">
          <legend className="h6 panel-title mb-32 w-full">{t("shippingDetails")}</legend>
          {addresses.data && addresses.data.length > 0 ? (
            <div className="mb-24">
              <p className="field-label">{t("savedAddresses")}</p>
              <ul className="flex flex-wrap gap-2">
                {addresses.data.map((address) => (
                  <li key={address.id}>
                    <button type="button" className="chip" onClick={() => applyAddress(address)}>
                      {address.label || address.line1}, {address.city}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mb-32 grid gap-4 sm:grid-cols-2 lg:gap-6">
            <div className="form-group">
              <label htmlFor="checkout-region" className="field-label">
                {t("region")}
              </label>
              <select
                id="checkout-region"
                {...register("region")}
                aria-invalid={Boolean(formState.errors.region)}
                aria-describedby={formState.errors.region ? "checkout-region-error" : undefined}
                data-testid="checkout-region"
              >
                <option value="">{t("regionPlaceholder")}</option>
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
              {formState.errors.region ? (
                <p id="checkout-region-error" className="field-error">
                  {formState.errors.region.message}
                </p>
              ) : null}
            </div>
            <Field label={t("city")} error={formState.errors.city?.message} {...register("city")} autoComplete="address-level2" />
            <div className="sm:col-span-2">
              <Field label={t("address1")} error={formState.errors.line1?.message} {...register("line1")} autoComplete="address-line1" />
            </div>
            <div className="sm:col-span-2">
              <Field label={t("address2")} error={formState.errors.line2?.message} {...register("line2")} autoComplete="address-line2" />
            </div>
            <div className="sm:col-span-2">
              <Field
                as="textarea"
                rows={4}
                label={t("notes")}
                placeholder={t("notesPlaceholder")}
                error={formState.errors.notes?.message}
                {...register("notes")}
              />
            </div>
          </div>
          {user ? <CheckboxField label={t("saveAddress")} {...register("saveAddress")} className="mb-32" /> : null}
        </fieldset>

        <fieldset disabled={busy} className="min-w-0">
          <legend className="h6 panel-title mb-24 w-full">{t("paymentMethods")}</legend>
          <div className="mb-48 grid gap-4 md:grid-cols-2" role="radiogroup" aria-label={t("paymentMethods")}>
            {methods.map(({ method, enabled }) => (
              <label key={method} className="choice-block" data-testid={`pay-${method}`}>
                <span>
                  <span className="block font-bold text-white">{t(`methods.${method}`)}</span>
                  <span className="block text-sm">{enabled ? t(`methods.${method}Text`) : t("methods.unavailable")}</span>
                </span>
                <input type="radio" value={method} disabled={!enabled} {...register("paymentMethod")} />
              </label>
            ))}
          </div>

          <div className="mb-32 space-y-4">
            <CheckboxField
              label={t("ageConfirm")}
              error={formState.errors.ageConfirmed?.message}
              {...register("ageConfirmed")}
              data-testid="age-confirm-checkbox"
            />
            <CheckboxField
              label={t.rich("terms", {
                link: (chunks) => (
                  <Link href="/terms" target="_blank" className="text-link">
                    {chunks}
                  </Link>
                ),
              })}
              error={formState.errors.termsAccepted?.message}
              {...register("termsAccepted")}
              data-testid="terms-checkbox"
            />
          </div>
        </fieldset>

        <p className="sr-only" aria-live="assertive">
          {stageText}
        </p>
        <button type="submit" className="cus-btn is-filled w-full sm:w-auto" disabled={busy} aria-busy={busy} data-testid="place-order">
          {busy ? <span className="spinner" aria-hidden /> : <Lock className="!h-5 !w-5" aria-hidden />}
          {busy ? stageText : t("placeOrder")}
        </button>
        <p className="mt-4 text-sm">{t("legalNote")}</p>
        <p className="mt-1 flex items-center gap-2 text-sm">
          <Lock className="h-4 w-4" aria-hidden />
          {t("secure")}
        </p>
      </div>

      <div className="space-y-6">
        <div className="surface p-4 sm:p-6">
          <h2 className="h6 mb-16 text-white">{t("summary")}</h2>
          <ul className="space-y-3" data-testid="checkout-items">
            {cart.data.items.map((line) => (
              <li key={line.id} className="summary-row text-sm">
                <span className="min-w-0">
                  {line.name}
                  {line.variantLabel ? <span className="text-gray"> · {line.variantLabel}</span> : null}
                  <span className="text-gray"> × {line.quantity}</span>
                </span>
                <span className="shrink-0">{formatAmd(line.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </div>
        <CartSummary totals={totals} title={tCart("cartTotal")} updating={quote.isFetching}>
          <CouponForm
            applied={quote.data?.coupon ?? null}
            onApply={(code) => update({ coupon: code })}
            onRemove={() => update({ coupon: undefined })}
            pending={quote.isFetching}
          />
        </CartSummary>
      </div>
    </form>
  );
}
