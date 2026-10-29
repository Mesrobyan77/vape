"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminDashboard, InventoryMovementRow } from "@/lib/api/types";
import { AdminTable, PageTitle, Panel, useAdminGet, useAdminList } from "../ui";
import { formatDateTime } from "./shared";

export function InventorySection() {
  const [page, setPage] = useState(1);
  const movements = useAdminList<InventoryMovementRow>("/admin/inventory/movements", { page, pageSize: 25 }, "movements");
  const dashboard = useAdminGet<AdminDashboard>("/admin/dashboard", ["dashboard"]);
  return (
    <>
      <PageTitle>Inventory</PageTitle>
      <div className="space-y-6">
        <Panel title="Low stock">
          {dashboard.data && dashboard.data.lowStock.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {dashboard.data.lowStock.map((v) => (
                <li key={v.variantId} className="flex justify-between rounded-[5px] border border-white/10 px-3 py-2">
                  <Link href={`/admin/products/${v.productId}`} className="text-white hover:text-primary-2">
                    {v.productName} · <span className="font-mono">{v.sku}</span>
                  </Link>
                  <span className={v.stock === 0 ? "text-danger" : "text-warning"}>{v.stock}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">{dashboard.isPending ? "Loading…" : "No low-stock variants."}</p>
          )}
          <p className="mt-3 text-xs">To change stock, open the product and use “Adjust stock” on a variant. Adjustments are atomic and audit-logged.</p>
        </Panel>
        <Panel title="Stock movements">
          <AdminTable
            testId="admin-movements"
            query={movements}
            rowKey={(m) => m.id}
            empty="No stock movements yet."
            onPage={setPage}
            columns={[
              { header: "When", cell: (m) => formatDateTime(m.createdAt) },
              { header: "SKU", cell: (m) => <span className="font-mono">{m.sku}</span> },
              { header: "Change", cell: (m) => <span className={m.delta < 0 ? "text-danger" : "text-success"}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span> },
              { header: "Before → after", cell: (m) => `${m.stockBefore} → ${m.stockAfter}` },
              { header: "Kind", cell: (m) => m.kind.replace(/_/g, " ") },
              { header: "Reason", cell: (m) => m.reason },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
