"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminOrderDetail, AdminOrderRow, OrderStatus } from "@/lib/api/types";
import { ORDER_STATUSES } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { useToast } from "@/components/providers/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminError, AdminTable, adminErrorText, PageTitle, Panel, SelectInput, TextInput, useAdminGet, useAdminList } from "../ui";
import { formatDateTime, OrderStatusPill } from "./shared";

export function OrdersSection({ id }: { id?: string }) {
  return id ? <OrderDetail id={id} /> : <OrdersList />;
}

function OrdersList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const list = useAdminList<AdminOrderRow>("/admin/orders", { page, pageSize: 20, status: status || undefined, q: search || undefined }, "orders");
  return (
    <>
      <PageTitle>Orders</PageTitle>
      <Panel>
        <form
          className="mb-16 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q.trim());
          }}
        >
          <div className="w-64">
            <TextInput label="Search (number, email, name)" value={q} onChange={setQ} />
          </div>
          <div className="w-52">
            <SelectInput
              label="Status"
              value={status}
              onChange={(v) => {
                setPage(1);
                setStatus(v);
              }}
              options={[{ value: "", label: "All" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]}
            />
          </div>
          <button type="submit" className="cus-btn is-sm">
            Search
          </button>
        </form>
        <AdminTable
          testId="admin-orders"
          query={list}
          rowKey={(o) => o.id}
          empty="No orders found."
          onPage={setPage}
          columns={[
            {
              header: "Order",
              cell: (o) => (
                <Link href={`/admin/orders/${o.id}`} className="font-heading text-sm text-white hover:text-primary-2">
                  {o.number}
                  {o.reconciliationRequired ? <span className="ml-2 rounded bg-danger/30 px-1.5 text-[10px] text-danger">RECONCILE</span> : null}
                </Link>
              ),
            },
            { header: "Date", cell: (o) => formatDateTime(o.createdAt) },
            { header: "Customer", cell: (o) => <span>{o.customerName}<span className="block text-xs text-gray">{o.customerEmail}</span></span> },
            { header: "Status", cell: (o) => <OrderStatusPill status={o.status} /> },
            { header: "Payment", cell: (o) => `${o.paymentMethod} · ${o.paymentStatus}` },
            { header: "Total", cell: (o) => formatAmd(o.total) },
          ]}
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
      setTarget(null);
      setNote("");
      toast.success(`Order moved to ${data.status.replace(/_/g, " ")}.`);
    },
    onError: (err) => {
      setTarget(null);
      toast.error(adminErrorText(err));
      void order.refetch();
    },
  });

  if (order.isPending) return <div className="skeleton h-[520px]" aria-busy="true" />;
  if (order.isError) return <AdminError error={order.error} onRetry={() => order.refetch()} retrying={order.isFetching} />;
  const o = order.data;

  return (
    <>
      <PageTitle actions={<Link href="/admin/orders" className="cus-btn is-sm">Back to orders</Link>}>Order {o.number}</PageTitle>
      <div className="space-y-6" data-testid="admin-order-detail">
        {o.reconciliation.required ? (
          <p className="form-alert is-error" role="alert">
            Reconciliation required: {o.reconciliation.reason ?? "unknown reason"}. Do not fulfil until payment and stock are reconciled (refund if needed).
          </p>
        ) : null}
        <Panel title="Status">
          <div className="mb-16 flex flex-wrap items-center gap-3">
            <OrderStatusPill status={o.status} />
            <span className="text-sm">
              Payment: {o.paymentMethod} · {o.paymentStatus}
            </span>
          </div>
          {o.allowedTransitions.length ? (
            <div className="space-y-3">
              <TextInput label="Note for the timeline (optional)" value={note} onChange={setNote} />
              <div className="flex flex-wrap gap-2" data-testid="order-transitions">
                {o.allowedTransitions.map((to) => (
                  <button
                    key={to}
                    type="button"
                    className={`cus-btn is-sm ${SENSITIVE.includes(to) ? "is-danger" : ""}`}
                    onClick={() => setTarget(to)}
                    disabled={transition.isPending}
                    data-testid={`transition-${to}`}
                  >
                    Mark {to.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              <p className="text-xs">Only transitions permitted by the order state machine are offered; the server re-validates every change.</p>
            </div>
          ) : (
            <p className="text-sm">This order is in a final state.</p>
          )}
        </Panel>
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Items">
            <ul className="divide-y divide-white/10">
              {o.items.map((item) => (
                <li key={item.sku} className="flex justify-between gap-3 py-2 text-sm">
                  <span>
                    <span className="text-white">{item.name}</span> · {item.variantLabel} · <span className="font-mono">{item.sku}</span> × {item.quantity}
                  </span>
                  <span>{formatAmd(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="summary-row"><dt>Subtotal</dt><dd>{formatAmd(o.totals.subtotal)}</dd></div>
              <div className="summary-row"><dt>Discount</dt><dd>−{formatAmd(o.totals.discount)}</dd></div>
              <div className="summary-row"><dt>Shipping</dt><dd>{formatAmd(o.totals.shipping)}</dd></div>
              <div className="summary-row font-bold"><dt>Total</dt><dd>{formatAmd(o.totals.total)}</dd></div>
              <div className="summary-row !text-gray"><dt>VAT {o.totals.vatRatePercent}% included</dt><dd>{formatAmd(o.totals.vatAmount)}</dd></div>
            </dl>
          </Panel>
          <Panel title="Customer & delivery">
            <p className="text-sm leading-relaxed">
              <span className="text-white">{o.customer.firstName} {o.customer.lastName}</span>
              <br />
              {o.customer.email} · {o.customer.phone}
              <br />
              {o.shipping.line1} {o.shipping.line2}
              <br />
              {o.shipping.city}, {o.shipping.region}
              {o.shipping.notes ? (
                <>
                  <br />
                  Notes: {o.shipping.notes}
                </>
              ) : null}
            </p>
          </Panel>
          <Panel title="Payments">
            {o.payments.length === 0 ? (
              <p className="text-sm">No payment records.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {o.payments.map((p) => (
                  <li key={p.id}>
                    {p.provider} · {p.status} · {formatAmd(p.amount)} · {p.providerRef ?? "no ref"} · {formatDateTime(p.createdAt)}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Timeline">
            <ol className="space-y-2 border-l border-primary/50 pl-4 text-sm">
              {o.timeline.map((t, i) => (
                <li key={i}>
                  <span className="text-white">{t.status.replace(/_/g, " ")}</span> · {formatDateTime(t.at)}
                  {t.note ? <span className="block">{t.note}</span> : null}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
      <ConfirmDialog
        open={target !== null}
        title={`Move order to “${target?.replace(/_/g, " ")}”?`}
        body={
          target && SENSITIVE.includes(target) ? (
            <p>This is a sensitive action. Reserved stock is restored exactly once; refunds must also be completed with the payment provider.</p>
          ) : (
            <p>The customer will be notified by email where applicable.</p>
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
