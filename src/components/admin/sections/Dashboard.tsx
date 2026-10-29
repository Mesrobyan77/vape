"use client";

import Link from "next/link";
import type { AdminDashboard } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { AdminError, PageTitle, Panel, StatCard, useAdminGet } from "../ui";
import { OrderStatusPill } from "./shared";

export function DashboardSection() {
  const q = useAdminGet<AdminDashboard>("/admin/dashboard", ["dashboard"]);
  return (
    <>
      <PageTitle actions={<button type="button" className="cus-btn is-sm" onClick={() => q.refetch()} disabled={q.isFetching}>{q.isFetching ? "Refreshing…" : "Refresh"}</button>}>
        Dashboard
      </PageTitle>
      {q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      ) : q.isError ? (
        <AdminError error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <div className="space-y-6" data-testid="admin-dashboard">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Orders today" value={q.data.ordersToday} />
            <StatCard label="Orders total" value={q.data.ordersTotal} />
            <StatCard label="Revenue (paid & fulfilled)" value={formatAmd(q.data.revenuePaid)} />
            <StatCard label="Customers" value={q.data.customers} />
            <StatCard label="Pending (COD) orders" value={q.data.pendingOrders} tone={q.data.pendingOrders ? "warning" : undefined} />
            <StatCard label="Awaiting payment" value={q.data.awaitingPayment} />
            <StatCard label="Need reconciliation" value={q.data.reconciliationRequired} tone={q.data.reconciliationRequired ? "danger" : undefined} />
            <StatCard label="Low-stock variants" value={q.data.lowStock.length} tone={q.data.lowStock.length ? "warning" : undefined} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Recent orders">
              {q.data.recentOrders.length === 0 ? (
                <p>No orders yet.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {q.data.recentOrders.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <Link href={`/admin/orders/${o.id}`} className="font-heading text-sm text-white hover:text-primary-2">
                        {o.number}
                      </Link>
                      <span className="text-sm">{o.customerName}</span>
                      <OrderStatusPill status={o.status} />
                      <span>{formatAmd(o.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Low stock">
              {q.data.lowStock.length === 0 ? (
                <p>All variants are above the low-stock threshold.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {q.data.lowStock.map((v) => (
                    <li key={v.variantId} className="flex items-center justify-between gap-2 py-2">
                      <Link href={`/admin/products/${v.productId}`} className="text-white hover:text-primary-2">
                        {v.productName} <span className="text-gray">· {v.sku}</span>
                      </Link>
                      <span className={v.stock === 0 ? "text-danger" : "text-warning"}>{v.stock}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
