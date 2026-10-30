"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Mail, MapPin, Phone, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminOrderDetail, AdminOrderRow, OrderStatus } from "@/lib/api/types";
import { ORDER_STATUSES } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { useToast } from "@/components/providers/Toaster";
import { AdminConfirm } from "../dialogs";
import {
  AdminError,
  AdminTable,
  adminErrorText,
  Button,
  PageTitle,
  Panel,
  SearchField,
  SelectInput,
  StatusPill,
  TextInput,
  Toolbar,
  useAdminGet,
  useAdminList,
  useUrlListState,
  type Column,
  type PillTone,
} from "../ui";
import { formatDateTime, orderStatusLabel, OrderStatusPill } from "./shared";

export function OrdersSection({ id }: { id?: string }) {
  return id ? <OrderDetail id={id} /> : <OrdersList />;
}

const PAYMENT_TONE: Record<string, PillTone> = {
  paid: "success",
  captured: "success",
  succeeded: "success",
  pending: "warning",
  requires_action: "warning",
  failed: "danger",
  refunded: "info",
  created: "neutral",
  cancelled: "neutral",
  expired: "neutral",
};

function OrdersList() {
  const defaults = useMemo(() => ({ page: 1, status: "", q: "" }), []);
  const { state, update, reset, isFiltered } = useUrlListState(defaults);
  const list = useAdminList<AdminOrderRow>("/admin/orders", { page: state.page, pageSize: 20, status: state.status || undefined, q: state.q || undefined }, "orders");

  const columns: Column<AdminOrderRow>[] = [
    {
      header: "Order",
      cell: (o) => (
        <>
          <Link href={`/admin/orders/${o.id}`} className="adm-cell-title adm-mono">
            {o.number}
          </Link>
          {o.reconciliationRequired ? (
            <span className="adm-cell-sub">
              <StatusPill tone="danger">needs reconciliation</StatusPill>
            </span>
          ) : null}
        </>
      ),
    },
    { header: "Placed", cell: (o) => formatDateTime(o.createdAt), hideBelow: "md" },
    {
      header: "Customer",
      cell: (o) => (
        <>
          <span className="adm-cell-strong">{o.customerName}</span>
          <span className="adm-cell-sub">{o.customerEmail}</span>
        </>
      ),
      hideBelow: "sm",
    },
    { header: "Status", cell: (o) => <OrderStatusPill status={o.status} /> },
    {
      header: "Payment",
      cell: (o) => (
        <span className="adm-rowactions">
          <StatusPill tone="neutral" dot={false}>
            {o.paymentMethod}
          </StatusPill>
          <StatusPill tone={PAYMENT_TONE[o.paymentStatus] ?? "neutral"}>{o.paymentStatus.replace(/_/g, " ")}</StatusPill>
        </span>
      ),
      hideBelow: "lg",
    },
    { header: "Total", cell: (o) => <span className="adm-money adm-cell-strong">{formatAmd(o.total)}</span>, align: "num" },
  ];

  return (
    <>
      <PageTitle description="Every order placed through the storefront, newest first.">Orders</PageTitle>
      <Panel flush>
        <Toolbar>
          <SearchField label="Search orders" value={state.q} placeholder="Number, email or surname" testId="orders-search" onSubmit={(q) => update({ q, page: 1 })} />
          <SelectInput
            label="Status"
            className="md:w-56"
            value={state.status}
            onChange={(status) => update({ status, page: 1 })}
            testId="orders-status"
            options={[
              { value: "", label: "All orders" },
              { value: "reconciliation", label: "Needs reconciliation" },
              ...ORDER_STATUSES.map((s) => ({ value: s, label: orderStatusLabel(s) })),
            ]}
          />
          {isFiltered ? (
            <Button variant="quiet" onClick={reset} data-testid="orders-clear">
              Clear filters
            </Button>
          ) : null}
        </Toolbar>
        <AdminTable
          testId="admin-orders"
          query={list}
          rowKey={(o) => o.id}
          columns={columns}
          caption="Orders"
          onPage={(page) => update({ page })}
          empty={isFiltered ? "No orders match these filters." : "No orders yet."}
          emptyBody={isFiltered ? "Try another status, or search by order number, customer email or surname." : "New orders appear here as soon as a customer checks out."}
          emptyAction={isFiltered ? <Button onClick={reset}>Clear filters</Button> : undefined}
        />
      </Panel>
    </>
  );
}

const SENSITIVE: OrderStatus[] = ["cancelled", "refunded"];

function OrderDetail({ id }: { id: string }) {
  const client = useQueryClient();
  const toast = useToast();
  const order = useAdminGet<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}`, ["order", id]);
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");

  const transition = useMutation({
    mutationFn: (to: OrderStatus) =>
      api<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}/transition`, { method: "POST", body: { to, note: note.trim() || undefined, confirm: true } }),
    onSuccess: (data) => {
      client.setQueryData(["admin", "order", id], data);
      void client.invalidateQueries({ queryKey: ["admin", "orders"] });
      void client.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      setTarget(null);
      setNote("");
      toast.success(`Order moved to ${orderStatusLabel(data.status)}.`);
    },
    onError: (err) => {
      setTarget(null);
      toast.error(adminErrorText(err));
      void order.refetch();
    },
  });

  if (order.isPending) {
    return (
      <>
        <div className="adm-skeleton mb-4 h-7 w-64" aria-busy="true" />
        <div className="adm-grid lg:grid-cols-3">
          <div className="adm-skeleton h-[420px] lg:col-span-2" />
          <div className="adm-skeleton h-[420px]" />
        </div>
      </>
    );
  }
  if (order.isError || !order.data) {
    return (
      <div className="adm-stack">
        <Link href="/admin/orders" className="adm-linkbtn">
          <ArrowLeft aria-hidden /> Back to orders
        </Link>
        <AdminError error={order.error} onRetry={() => order.refetch()} retrying={order.isFetching} />
      </div>
    );
  }
  const o = order.data;

  return (
    <>
      <PageTitle
        description={`Placed ${formatDateTime(o.createdAt)} · ${o.itemCount} item${o.itemCount === 1 ? "" : "s"} · ${formatAmd(o.total)}`}
        actions={
          <Link href="/admin/orders" className="adm-btn">
            <ArrowLeft aria-hidden /> Back to orders
          </Link>
        }
      >
        <span className="adm-mono">Order {o.number}</span>
      </PageTitle>

      <div className="adm-stack" data-testid="admin-order-detail">
        {o.reconciliation.required ? (
          <div className="adm-alert is-error" role="alert">
            <ShieldAlert aria-hidden />
            <span>
              <strong>Reconciliation required.</strong> {o.reconciliation.reason ?? "Payment and stock disagree."} Do not fulfil until this is settled — refund
              through the payment provider if the money never arrived.
            </span>
          </div>
        ) : null}

        <div className="adm-grid lg:grid-cols-3">
          <div className="adm-stack lg:col-span-2">
            <Panel title="Items" subtitle={`${o.items.length} line${o.items.length === 1 ? "" : "s"}`} flush>
              <div className="adm-tablewrap">
                <table className="adm-table">
                  <caption className="sr-only">Ordered items</caption>
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col" className="hidden sm:table-cell">
                        SKU
                      </th>
                      <th scope="col" className="is-num">
                        Qty
                      </th>
                      <th scope="col" className="is-num">
                        Line total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.items.map((item) => (
                      <tr key={item.sku}>
                        <td>
                          <span className="adm-rowactions">
                            {/* eslint-disable-next-line @next/next/no-img-element -- order line thumbnail from the media CDN */}
                            {item.image ? <img src={item.image.url} alt="" className="adm-thumb" width={44} height={44} /> : null}
                            <span>
                              <span className="adm-cell-strong">{item.name}</span>
                              <span className="adm-cell-sub">{item.variantLabel}</span>
                            </span>
                          </span>
                        </td>
                        <td className="adm-mono hidden sm:table-cell">{item.sku}</td>
                        <td className="is-num">{item.quantity}</td>
                        <td className="is-num adm-cell-strong">{formatAmd(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="adm-totals p-4 sm:p-5">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatAmd(o.totals.subtotal)}</dd>
                </div>
                <div>
                  <dt>Discount</dt>
                  <dd>−{formatAmd(o.totals.discount)}</dd>
                </div>
                <div>
                  <dt>Shipping</dt>
                  <dd>{formatAmd(o.totals.shipping)}</dd>
                </div>
                <div className="is-total">
                  <dt>Total</dt>
                  <dd>{formatAmd(o.totals.total)}</dd>
                </div>
                <div className="is-muted">
                  <dt>VAT {o.totals.vatRatePercent}% included</dt>
                  <dd>{formatAmd(o.totals.vatAmount)}</dd>
                </div>
              </dl>
            </Panel>

            <Panel title="Payments">
              {o.payments.length === 0 ? (
                <p className="adm-hint">No payment records. Cash-on-delivery orders are settled when the courier collects.</p>
              ) : (
                <ul className="adm-list" style={{ margin: "calc(-1 * var(--adm-sp-5))" }}>
                  {o.payments.map((p) => (
                    <li className="adm-list-item" key={p.id}>
                      <span className="adm-list-item-main">
                        <span className="adm-cell-strong">{p.provider}</span>
                        <span className="adm-cell-sub adm-mono">{p.providerRef ?? "no provider reference"}</span>
                      </span>
                      <StatusPill tone={PAYMENT_TONE[p.status] ?? "neutral"}>{p.status.replace(/_/g, " ")}</StatusPill>
                      <span className="adm-money">{formatAmd(p.amount)}</span>
                      <span className="adm-cell-sub">{formatDateTime(p.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="adm-stack">
            <Panel title="Status">
              <div className="adm-rowactions" style={{ gap: "var(--adm-sp-2)", marginBottom: "var(--adm-sp-3)" }}>
                <OrderStatusPill status={o.status} />
                <StatusPill tone={PAYMENT_TONE[o.paymentStatus] ?? "neutral"}>payment: {o.paymentStatus.replace(/_/g, " ")}</StatusPill>
              </div>
              {o.reservationExpiresAt ? (
                <p className="adm-hint" style={{ marginBottom: "var(--adm-sp-3)" }}>
                  <Clock aria-hidden width={13} height={13} style={{ display: "inline", verticalAlign: "-2px" }} /> Reserved stock expires {formatDateTime(o.reservationExpiresAt)}.
                </p>
              ) : null}
              {o.allowedTransitions.length ? (
                <div className="adm-stack">
                  <TextInput label="Note for the timeline" value={note} onChange={setNote} placeholder="Optional — visible to other admins" testId="order-note" />
                  <div className="adm-grid" style={{ gap: "var(--adm-sp-2)" }} data-testid="order-transitions">
                    {o.allowedTransitions.map((to) => (
                      <Button
                        key={to}
                        variant={SENSITIVE.includes(to) ? "danger" : to === "paid" || to === "delivered" ? "primary" : "default"}
                        className="is-block"
                        onClick={() => setTarget(to)}
                        disabled={transition.isPending}
                        data-testid={`transition-${to}`}
                      >
                        Mark {orderStatusLabel(to)}
                      </Button>
                    ))}
                  </div>
                  <p className="adm-hint">Only transitions permitted by the order state machine are offered; the server re-validates every change.</p>
                </div>
              ) : (
                <p className="adm-hint">This order is in a final state — no further transitions are allowed.</p>
              )}
            </Panel>

            <Panel title="Customer & delivery">
              <dl className="adm-kv">
                <dt>Name</dt>
                <dd>
                  {o.customer.firstName} {o.customer.lastName}
                </dd>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${o.customer.email}`} className="adm-linkbtn is-muted">
                    <Mail aria-hidden width={13} height={13} /> {o.customer.email}
                  </a>
                </dd>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${o.customer.phone.replace(/\s/g, "")}`} className="adm-linkbtn is-muted">
                    <Phone aria-hidden width={13} height={13} /> {o.customer.phone}
                  </a>
                </dd>
                <dt>Address</dt>
                <dd>
                  <MapPin aria-hidden width={13} height={13} style={{ display: "inline", verticalAlign: "-2px" }} /> {o.shipping.line1}
                  {o.shipping.line2 ? `, ${o.shipping.line2}` : ""}
                  <br />
                  {o.shipping.city}, {o.shipping.region}
                </dd>
                {o.shipping.notes ? (
                  <>
                    <dt>Notes</dt>
                    <dd>{o.shipping.notes}</dd>
                  </>
                ) : null}
              </dl>
            </Panel>

            <Panel title="Timeline" subtitle="Every status change, newest last">
              {o.timeline.length === 0 ? (
                <p className="adm-hint">No status changes recorded yet.</p>
              ) : (
                <ol className="adm-timeline">
                  {o.timeline.map((t, i) => (
                    <li key={`${t.status}-${t.at}-${i}`} className={i === o.timeline.length - 1 ? undefined : "is-muted"}>
                      <span className="adm-cell-strong">{orderStatusLabel(t.status)}</span>
                      <span className="adm-cell-sub">{formatDateTime(t.at)}</span>
                      {t.note ? (
                        <span className="adm-cell-sub" style={{ whiteSpace: "pre-wrap" }}>
                          {t.note}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </div>
      </div>

      <AdminConfirm
        open={target !== null}
        title={`Move order ${o.number} to “${target ? orderStatusLabel(target) : ""}”?`}
        body={
          target && SENSITIVE.includes(target) ? (
            <p className="adm-hint">This is a sensitive action. Reserved stock is restored exactly once; refunds must also be completed with the payment provider.</p>
          ) : (
            <p className="adm-hint">The customer will be notified by email where applicable.</p>
          )
        }
        danger={target !== null && SENSITIVE.includes(target)}
        confirmLabel="Confirm"
        pending={transition.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={() => target && transition.mutate(target)}
      />
    </>
  );
}
