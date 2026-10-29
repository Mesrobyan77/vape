"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, isApiError } from "@/lib/api/client";
import type { PaymentRedirect, PaymentStatusResponse } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { useMe } from "@/hooks/use-me";
import { useErrorMessage } from "@/hooks/use-error-message";
import { ArrowRightIcon } from "@/components/icons";
import { ErrorState, EmptyState } from "@/components/ui/States";

const POLL_MS = 3000;

function isSettled(status: PaymentStatusResponse) {
  if (status.method === "cod") return true;
  return !["awaiting_payment"].includes(status.orderStatus) || ["succeeded", "failed", "cancelled", "expired", "refunded"].includes(status.paymentStatus);
}

function continuePayment(redirect: PaymentRedirect) {
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

/**
 * Order confirmation / payment status. Everything shown comes from a server-side status
 * check; the URL only carries the public order number, never a payment result.
 */
export function OrderStatusView({ orderNumber }: { orderNumber: string | null }) {
  const t = useTranslations("success");
  const tOrder = useTranslations("orderStatus");
  const tPay = useTranslations("paymentStatus");
  const format = useFormatter();
  const me = useMe();
  const errorMessage = useErrorMessage();

  const status = useQuery({
    queryKey: ["payment-status", orderNumber],
    queryFn: ({ signal }) => api<PaymentStatusResponse>(`/payments/status/${encodeURIComponent(orderNumber ?? "")}`, { signal }),
    enabled: Boolean(orderNumber),
    refetchInterval: (query) => (query.state.data && isSettled(query.state.data) ? false : POLL_MS),
    refetchIntervalInBackground: false,
    retry: (count, error) => !(isApiError(error) && error.status === 404) && count < 3,
  });

  if (!orderNumber) return <EmptyState title={t("missing")} />;

  if (status.isPending) {
    return (
      <div className="surface flex items-center gap-3 rounded-[10px] p-8 text-white" role="status" data-testid="order-status-loading">
        <span className="spinner" aria-hidden />
        {t("checking")}
      </div>
    );
  }

  if (status.isError) {
    if (isApiError(status.error) && status.error.status === 404) {
      return (
        <EmptyState
          title={t("notFound")}
          action={
            me.data?.user ? (
              <Link href="/account/orders" className="cus-btn">
                {t("viewOrders")}
              </Link>
            ) : null
          }
        />
      );
    }
    return <ErrorState message={errorMessage(status.error)} onRetry={() => status.refetch()} retrying={status.isFetching} />;
  }

  const data = status.data;
  const pending = !isSettled(data);
  const failed = data.orderStatus === "payment_failed" || data.paymentStatus === "failed";
  const expired = data.orderStatus === "expired";
  const cancelled = data.orderStatus === "cancelled";

  let tone: "ok" | "wait" | "bad" = "ok";
  let title = t("confirmedTitle");
  let body = data.method === "cod" ? t("codBody", { total: formatAmd(data.amount) }) : t("paidBody");
  if (pending) {
    tone = "wait";
    title = t("pendingTitle");
    body = t("pendingBody");
  } else if (failed) {
    tone = "bad";
    title = t("failedTitle");
    body = t("failedBody");
  } else if (expired) {
    tone = "bad";
    title = t("expiredTitle");
    body = t("expiredBody");
  } else if (cancelled) {
    tone = "bad";
    title = t("cancelledTitle");
    body = t("cancelledBody");
  }

  const Icon = tone === "ok" ? CheckCircle2 : tone === "wait" ? Clock : XCircle;
  const color = tone === "ok" ? "text-success" : tone === "wait" ? "text-warning" : "text-danger";

  return (
    <div className="surface mx-auto max-w-[760px] rounded-[10px] p-6 sm:p-10" data-testid="order-status" data-order-status={data.orderStatus} data-payment-status={data.paymentStatus}>
      <div className="mb-24 flex items-start gap-4" aria-live="polite">
        <Icon className={`h-10 w-10 shrink-0 ${color}`} aria-hidden />
        <div>
          <h2 className="h4 mb-8 text-white">{title}</h2>
          <p>{body}</p>
          {pending && data.reservationExpiresAt ? (
            <p className="mt-2 text-sm">{t("reservedUntil", { time: format.dateTime(new Date(data.reservationExpiresAt), { timeStyle: "short" }) })}</p>
          ) : null}
        </div>
      </div>
      <dl className="mb-32 grid gap-3 sm:grid-cols-2">
        <div className="summary-row surface-row">
          <dt>{t("orderNumber")}</dt>
          <dd className="font-heading" data-testid="order-number">
            {orderNumber}
          </dd>
        </div>
        <div className="summary-row">
          <dt>{t("total")}</dt>
          <dd>{formatAmd(data.amount)}</dd>
        </div>
        <div className="summary-row">
          <dt>{t("status")}</dt>
          <dd>{tOrder(data.orderStatus)}</dd>
        </div>
        <div className="summary-row">
          <dt>{t("payment")}</dt>
          <dd>{tPay(data.paymentStatus)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-3">
        {pending && data.redirect ? (
          <button type="button" className="cus-btn is-filled" onClick={() => continuePayment(data.redirect!)}>
            {t("payNow")}
            <ArrowRightIcon />
          </button>
        ) : null}
        {me.data?.user ? (
          <Link href={`/account/orders/${encodeURIComponent(orderNumber)}`} className="cus-btn">
            {t("viewOrders")}
          </Link>
        ) : null}
        <Link href="/shop" className="cus-btn">
          {t("backHome")}
          <ArrowRightIcon />
        </Link>
      </div>
    </div>
  );
}
