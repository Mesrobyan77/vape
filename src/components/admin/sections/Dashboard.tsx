"use client";

import Link from "next/link";
import { Boxes, CircleDollarSign, RefreshCw, ShoppingBag, TriangleAlert, Users } from "lucide-react";
import { formatAmd } from "@/lib/money";
import type { AdminDashboard } from "@/lib/api/types";
import { AdminError, Button, PageTitle, Panel, StatCard, useAdminGet } from "../ui";
import { OrderStatusPill } from "./shared";

export function DashboardSection() {
  const q = useAdminGet<AdminDashboard>("/admin/dashboard", ["dashboard"]);

  return (
    <>
      <PageTitle
        description="Today's orders, revenue and the queues that need someone."
        actions={
          <Button onClick={() => q.refetch()} disabled={q.isFetching} data-testid="dashboard-refresh">
            <RefreshCw aria-hidden /> {q.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        }
      >
        Dashboard
      </PageTitle>

      {q.isPending ? (
        <div className="adm-grid sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="adm-skeleton h-[104px]" aria-busy="true" />
          ))}
        </div>
      ) : q.isError ? (
        <AdminError error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : q.data ? (
        <DashboardData d={q.data} />
      ) : null}
    </>
  );
}

function DashboardData({ d }: { d: AdminDashboard }) {
  return (
    <div className="adm-stack" data-testid="admin-dashboard">
      {d.reconciliationRequired > 0 ? (
        <div className="adm-alert is-error" role="alert">
          <TriangleAlert aria-hidden />
          <span>
            <strong>{d.reconciliationRequired}</strong> order{d.reconciliationRequired === 1 ? "" : "s"} need reconciliation. Do not fulfil them until payment and
            stock are settled.
          </span>
          <span className="adm-alert-actions">
            <Link href="/admin/orders?status=reconciliation" className="adm-btn is-sm is-danger">
              Review now
            </Link>
          </span>
        </div>
      ) : null}

      <section aria-labelledby="kpi-today">
        <h2 className="adm-section-label" id="kpi-today">
          Today
        </h2>
        <div className="adm-grid sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Orders today"
            value={d.ordersToday}
            icon={<ShoppingBag aria-hidden />}
            hint={
              <Link href="/admin/orders" className="adm-linkbtn">
                All orders
              </Link>
            }
          />
          <StatCard label="Orders total" value={d.ordersTotal} icon={<ShoppingBag aria-hidden />} href="/admin/orders" hint="Open the order list" />
          <StatCard label="Revenue (paid & fulfilled)" value={formatAmd(d.revenuePaid)} icon={<CircleDollarSign aria-hidden />} hint="Counted once an order is delivered" />
          <StatCard label="Customers" value={d.customers} icon={<Users aria-hidden />} href="/admin/customers" hint="Open customer accounts" />
        </div>
      </section>

      <section aria-labelledby="kpi-attention">
        <h2 className="adm-section-label" id="kpi-attention">
          Needs attention
        </h2>
        <div className="adm-grid sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Pending (COD) orders"
            value={d.pendingOrders}
            tone={d.pendingOrders ? "warning" : undefined}
            href="/admin/orders?status=pending"
            hint="Waiting to be confirmed"
          />
          <StatCard
            label="Awaiting payment"
            value={d.awaitingPayment}
            tone={d.awaitingPayment ? "warning" : undefined}
            href="/admin/orders?status=awaiting_payment"
            hint="Reservation expires automatically"
          />
          <StatCard
            label="Need reconciliation"
            value={d.reconciliationRequired}
            tone={d.reconciliationRequired ? "danger" : "ok"}
            href="/admin/orders?status=reconciliation"
            hint={d.reconciliationRequired ? "Payment and stock disagree" : "Nothing outstanding"}
          />
          <StatCard
            label="Low-stock variants"
            value={d.lowStock.length}
            tone={d.lowStock.length ? "warning" : "ok"}
            href="/admin/inventory"
            icon={<Boxes aria-hidden />}
            hint="At or below the low-stock threshold"
          />
        </div>
      </section>

      <div className="adm-grid xl:grid-cols-2">
        <Panel title="Recent orders" subtitle="Newest first" flush>
          {d.recentOrders.length === 0 ? (
            <p className="p-5 text-[13px] text-[color:var(--adm-text-3)]">No orders yet. New orders appear here as soon as customers check out.</p>
          ) : (
            <ul className="adm-list">
              {d.recentOrders.map((o) => (
                <li className="adm-list-item" key={o.id}>
                  <span className="adm-list-item-main">
                    <Link href={`/admin/orders/${o.id}`} className="adm-cell-title adm-mono">
                      {o.number}
                    </Link>
                    <span className="adm-cell-sub">{o.customerName}</span>
                  </span>
                  <OrderStatusPill status={o.status} />
                  <span className="adm-money adm-cell-strong">{formatAmd(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Low stock" subtitle="Adjust stock from the product page" flush>
          {d.lowStock.length === 0 ? (
            <p className="p-5 text-[13px] text-[color:var(--adm-text-3)]">Every variant is above the low-stock threshold.</p>
          ) : (
            <ul className="adm-list">
              {d.lowStock.map((v) => (
                <li className="adm-list-item" key={v.variantId}>
                  <span className="adm-list-item-main">
                    <Link href={`/admin/products/${v.productId}`} className="adm-cell-title">
                      {v.productName}
                    </Link>
                    <span className="adm-cell-sub adm-mono">{v.sku}</span>
                  </span>
                  <span className={`adm-pill ${v.stock === 0 ? "is-danger" : "is-warning"}`}>{v.stock === 0 ? "Out of stock" : `${v.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
