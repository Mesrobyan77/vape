"use client";

import Link from "next/link";
import { Boxes, PackageOpen, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import type { AdminDashboard, InventoryMovementRow } from "@/lib/api/types";
import { AdminTable, Button, PageTitle, Panel, StatusPill, useAdminGet, useAdminList, useUrlListState, type Column } from "../ui";
import { StockAdjustDialog } from "./Products";
import { formatDateTime } from "./shared";

export function InventorySection() {
  const defaults = useMemo(() => ({ page: 1 }), []);
  const { state, update } = useUrlListState(defaults);
  const movements = useAdminList<InventoryMovementRow>("/admin/inventory/movements", { page: state.page, pageSize: 25 }, "movements");
  const dashboard = useAdminGet<AdminDashboard>("/admin/dashboard", ["dashboard"]);
  const [adjusting, setAdjusting] = useState<{ productId: string; variant: { id: string; sku: string; stock: number } } | null>(null);

  const columns: Column<InventoryMovementRow>[] = [
    { header: "When", cell: (m) => formatDateTime(m.createdAt), hideBelow: "sm" },
    { header: "SKU", cell: (m) => <span className="adm-mono">{m.sku}</span> },
    {
      header: "Change",
      cell: (m) => <StatusPill tone={m.delta < 0 ? "danger" : "success"}>{m.delta > 0 ? `+${m.delta}` : m.delta}</StatusPill>,
      align: "num",
    },
    { header: "Before → after", cell: (m) => <span className="adm-money">{m.stockBefore} → {m.stockAfter}</span>, align: "num", hideBelow: "md" },
    { header: "Kind", cell: (m) => <StatusPill tone="neutral" dot={false}>{m.kind.replace(/_/g, " ")}</StatusPill>, hideBelow: "lg" },
    {
      header: "Reason",
      cell: (m) => (
        <span className="adm-cell-sub" style={{ display: "block", maxWidth: "40ch" }}>
          {m.reason || "—"}
        </span>
      ),
    },
  ];

  const lowStock = dashboard.data?.lowStock ?? [];

  return (
    <>
      <PageTitle description="Stock levels that need attention and the audit trail of every unit that moved.">Inventory</PageTitle>
      <div className="adm-stack">
        <Panel
          title="Low stock"
          subtitle="At or below the low-stock threshold"
          flush
          actions={
            <Link href="/admin/products" className="adm-btn is-sm">
              <PackageOpen aria-hidden /> Browse products
            </Link>
          }
        >
          {dashboard.isPending ? (
            <div className="p-5" aria-busy="true">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="adm-skeleton mb-2 h-11" />
              ))}
            </div>
          ) : lowStock.length > 0 ? (
            <ul className="adm-list">
              {lowStock.map((v) => (
                <li className="adm-list-item" key={v.variantId}>
                  <span className="adm-list-item-main">
                    <Link href={`/admin/products/${v.productId}`} className="adm-cell-title">
                      {v.productName}
                    </Link>
                    <span className="adm-cell-sub adm-mono">{v.sku}</span>
                  </span>
                  <StatusPill tone={v.stock === 0 ? "danger" : "warning"}>{v.stock === 0 ? "Out of stock" : `${v.stock} left`}</StatusPill>
                  <Button
                    size="sm"
                    onClick={() => setAdjusting({ productId: v.productId, variant: { id: v.variantId, sku: v.sku, stock: v.stock } })}
                    data-testid={`adjust-${v.variantId}`}
                  >
                    <SlidersHorizontal aria-hidden /> Adjust
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-hint p-5">Nothing is below the low-stock threshold right now.</p>
          )}
          <p className="adm-note" style={{ padding: "0 var(--adm-sp-5) var(--adm-sp-4)" }}>
            <Boxes aria-hidden width={13} height={13} style={{ display: "inline", verticalAlign: "-2px" }} /> Adjustments are applied atomically, can never make
            stock negative, and are written to the audit log with the reason you give.
          </p>
        </Panel>

        <Panel title="Stock movements" subtitle="Reservations, sales, restocks and manual corrections" flush>
          <AdminTable
            testId="admin-movements"
            query={movements}
            rowKey={(m) => m.id}
            columns={columns}
            caption="Stock movements"
            onPage={(page) => update({ page })}
            empty="No stock movements yet."
            emptyBody="Movements are recorded when stock is reserved, sold, restocked or corrected."
          />
        </Panel>
      </div>

      {adjusting ? <StockAdjustDialog product={{ id: adjusting.productId }} variant={adjusting.variant} onClose={() => setAdjusting(null)} /> : null}
    </>
  );
}
