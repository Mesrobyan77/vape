"use client";

import type { ContactMessageRow, OrderStatus } from "@/lib/api/types";
import { StatusPill, type PillTone } from "../ui";

const ORDER_TONE: Record<OrderStatus, PillTone> = {
  pending: "warning",
  awaiting_payment: "warning",
  paid: "info",
  processing: "accent",
  shipped: "accent",
  delivered: "success",
  cancelled: "danger",
  refunded: "danger",
  payment_failed: "danger",
  expired: "neutral",
};

const READABLE: Record<string, string> = {
  awaiting_payment: "awaiting payment",
  payment_failed: "payment failed",
};

export const orderStatusLabel = (status: string) => READABLE[status] ?? status.replace(/_/g, " ");

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <StatusPill tone={ORDER_TONE[status] ?? "neutral"}>{orderStatusLabel(status)}</StatusPill>;
}

export function ProductStatusPill({ status }: { status: string }) {
  const tone: PillTone = status === "active" ? "success" : status === "draft" ? "warning" : "neutral";
  return <StatusPill tone={tone}>{status}</StatusPill>;
}

export function ActivePill({ active }: { active: boolean }) {
  return <StatusPill tone={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</StatusPill>;
}

export function MessageStatusPill({ status }: { status: ContactMessageRow["status"] }) {
  const tone: PillTone = status === "new" ? "warning" : status === "read" ? "info" : "neutral";
  return <StatusPill tone={tone}>{status}</StatusPill>;
}

/** Absolute, locale-stable timestamps — no clock-dependent rendering. */
export const formatDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
export const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" }) : "—");
