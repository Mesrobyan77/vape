"use client";

import type { OrderStatus } from "@/lib/api/types";

const TONE: Partial<Record<OrderStatus, string>> = {
  paid: "bg-success/20 text-success",
  delivered: "bg-success/20 text-success",
  processing: "bg-primary/30 text-primary-2",
  shipped: "bg-primary/30 text-primary-2",
  pending: "bg-warning/20 text-warning",
  awaiting_payment: "bg-warning/20 text-warning",
  cancelled: "bg-danger/20 text-danger",
  payment_failed: "bg-danger/20 text-danger",
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[status] ?? "bg-white/10"}`}>{status.replace(/_/g, " ")}</span>;
}

export const formatDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
