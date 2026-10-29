"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { api, apiPage, isApiError } from "@/lib/api/client";
import type { OrderDetail, OrderStatus, OrderSummary } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useToast } from "@/components/providers/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SafeImage } from "@/components/ui/SafeImage";
import { ArrowRightIcon } from "@/components/icons";

const TONE: Partial<Record<OrderStatus, string>> = {
  paid: "bg-success/20 text-success",
  delivered: "bg-success/20 text-success",
  shipped: "bg-primary/30 text-primary-2",
  processing: "bg-primary/30 text-primary-2",
  awaiting_payment: "bg-warning/20 text-warning",
  pending: "bg-warning/20 text-warning",
  cancelled: "bg-danger/20 text-danger",
  payment_failed: "bg-danger/20 text-danger",
  expired: "bg-white/10 text-gray",
  refunded: "bg-white/10 text-gray",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("orderStatus");
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${TONE[status] ?? "bg-white/10"}`}>{t(status)}</span>;
}

export function OrdersTable({ limit, showPagination = true }: { limit?: number; showPagination?: boolean }) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const [page, setPage] = useState(1);
  const pageSize = limit ?? 10;

  const orders = useQuery({
    queryKey: ["orders", page, pageSize],
    queryFn: ({ signal }) => apiPage<OrderSummary[]>("/orders/my-orders", { query: { page, pageSize }, signal }),
    placeholderData: (prev) => prev,
  });

  if (orders.isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={tCommon("loading")}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton h-14 w-full" />
        ))}
      </div>
    );
  }
  if (orders.isError) return <ErrorState compact message={errorMessage(orders.error)} onRetry={() => orders.refetch()} retrying={orders.isFetching} />;
  if (orders.data.data.length === 0) {
    return (
      <EmptyState
        title={t("noOrders")}
        action={
          <Link href="/shop" className="cus-btn">
            {tCommon("viewAll")}
            <ArrowRightIcon />
          </Link>
        }
      />
    );
  }

  const { data, meta } = orders.data;
  return (
    <div aria-busy={orders.isFetching}>
      <div className="overflow-x-auto">
        <table className="admin-table min-w-[560px]" data-testid="orders-table">
          <thead>
            <tr>
              <th scope="col">{t("orderNumber")}</th>
              <th scope="col">{t("date")}</th>
              <th scope="col">{t("status")}</th>
              <th scope="col">{t("total")}</th>
              <th scope="col">
                <span className="sr-only">{t("view")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((order) => (
              <tr key={order.number}>
                <td className="font-heading text-sm text-white">{order.number}</td>
                <td>{format.dateTime(new Date(order.createdAt), { dateStyle: "medium" })}</td>
                <td>
                  <OrderStatusBadge status={order.status} />
                </td>
                <td>{formatAmd(order.total)}</td>
                <td className="text-right">
                  <Link href={`/account/orders/${encodeURIComponent(order.number)}`} className="text-link">
                    {t("view")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showPagination && meta.totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" className="cus-btn is-sm" disabled={page <= 1 || orders.isFetching} onClick={() => setPage((p) => p - 1)}>
            {tCommon("previous")}
          </button>
          <span>
            {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            className="cus-btn is-sm"
            disabled={page >= meta.totalPages || orders.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            {tCommon("next")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function OrderDetailView({ number }: { number: string }) {
  const t = useTranslations("account");
  const tCart = useTranslations("cart");
  const tPay = useTranslations("paymentStatus");
  const tStatus = useTranslations("orderStatus");
  const format = useFormatter();
  const client = useQueryClient();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [confirm, setConfirm] = useState(false);

  const order = useQuery({
    queryKey: ["orders", "detail", number],
    queryFn: ({ signal }) => api<OrderDetail>(`/orders/${encodeURIComponent(number)}`, { signal }),
  });

  const cancel = useMutation({
    mutationFn: () => api<OrderDetail>(`/orders/${encodeURIComponent(number)}/cancel`, { method: "POST", body: {} }),
    onSuccess: (data) => {
      client.setQueryData(["orders", "detail", number], data);
      void client.invalidateQueries({ queryKey: ["orders"] });
      setConfirm(false);
      toast.success(t("cancelled"));
    },
    onError: (err) => {
      setConfirm(false);
      toast.error(errorMessage(err));
      void order.refetch();
    },
  });

  if (order.isPending) return <div className="skeleton h-[480px]" aria-busy="true" />;
  if (order.isError) {
    if (isApiError(order.error) && order.error.status === 404) return <EmptyState title={t("orderDetail", { number })} body={errorMessage(order.error)} />;
    return <ErrorState message={errorMessage(order.error)} onRetry={() => order.refetch()} retrying={order.isFetching} />;
  }
  const o = order.data;

  return (
    <div className="space-y-6" data-testid="order-detail">
      <div className="surface flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="h5 mb-8 text-white">{t("orderDetail", { number: o.number })}</h2>
          <p className="text-sm">{format.dateTime(new Date(o.createdAt), { dateStyle: "long", timeStyle: "short" })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={o.status} />
          <span className="text-sm">{tPay(o.paymentStatus)}</span>
          {o.canCancel ? (
            <button type="button" className="cus-btn is-sm is-danger" onClick={() => setConfirm(true)} data-testid="cancel-order">
              {t("cancelOrder")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="surface p-6">
          <h3 className="h6 mb-16 text-white">{t("items")}</h3>
          <ul className="divide-y divide-white/10">
            {o.items.map((item) => (
              <li key={item.sku} className="flex items-center gap-4 py-3">
                <span className="thumb h-16 w-16">
                  <SafeImage image={item.image} width={64} height={64} decorative sizes="64px" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-white">{item.name}</span>
                  <span className="block text-sm">
                    {item.variantLabel} · SKU {item.sku} · × {item.quantity}
                  </span>
                </span>
                <span>{formatAmd(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-6 space-y-2">
            <div className="summary-row">
              <dt>{tCart("subtotal")}</dt>
              <dd>{formatAmd(o.totals.subtotal)}</dd>
            </div>
            {o.totals.discount > 0 ? (
              <div className="summary-row">
                <dt>{tCart("discount")}</dt>
                <dd>−{formatAmd(o.totals.discount)}</dd>
              </div>
            ) : null}
            <div className="summary-row">
              <dt>{tCart("delivery")}</dt>
              <dd>{o.totals.shipping === 0 ? tCart("free") : formatAmd(o.totals.shipping)}</dd>
            </div>
            <div className="summary-row h6">
              <dt>{tCart("grandTotal")}</dt>
              <dd>{formatAmd(o.totals.total)}</dd>
            </div>
            <div className="summary-row text-sm !text-gray">
              <dt>{tCart("vatIncluded", { rate: o.totals.vatRatePercent })}</dt>
              <dd>{formatAmd(o.totals.vatAmount)}</dd>
            </div>
          </dl>
        </div>
        <div className="space-y-6">
          <div className="surface p-6">
            <h3 className="h6 mb-16 text-white">{t("shippingTo")}</h3>
            <address className="not-italic leading-relaxed">
              {o.customer.firstName} {o.customer.lastName}
              <br />
              {o.shipping.line1}
              {o.shipping.line2 ? (
                <>
                  <br />
                  {o.shipping.line2}
                </>
              ) : null}
              <br />
              {o.shipping.city}, {o.shipping.region}
              <br />
              {o.customer.phone}
            </address>
          </div>
          <div className="surface p-6">
            <h3 className="h6 mb-16 text-white">{t("timeline")}</h3>
            <ol className="space-y-3 border-l border-primary/50 pl-4">
              {o.timeline.map((entry, i) => (
                <li key={`${entry.status}-${i}`}>
                  <p className="font-semibold text-white">{tStatus(entry.status)}</p>
                  <p className="text-sm">{format.dateTime(new Date(entry.at), { dateStyle: "medium", timeStyle: "short" })}</p>
                  {entry.note ? <p className="text-sm">{entry.note}</p> : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={t("cancelOrder")}
        body={<p>{t("cancelConfirm")}</p>}
        confirmLabel={t("cancelOrder")}
        pending={cancel.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => cancel.mutate()}
      />
    </div>
  );
}
