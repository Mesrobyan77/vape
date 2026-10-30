"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgePercent, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminCoupon } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { useToast } from "@/components/providers/Toaster";
import { AdminConfirm, AdminDialog } from "../dialogs";
import { AdminError, AdminTable, adminErrorText, Button, PageTitle, Panel, SelectInput, TextInput, Toggle, useAdminGet, type Column } from "../ui";
import { ActivePill, formatDateTime } from "./shared";

interface Draft {
  id: string | null;
  code: string;
  type: "percent" | "fixed";
  value: string;
  minSubtotal: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
}

const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : "");

function toDraft(c?: AdminCoupon): Draft {
  return c
    ? {
        id: c.id,
        code: c.code,
        type: c.type,
        value: String(c.value),
        minSubtotal: String(c.minSubtotal),
        active: c.active,
        startsAt: toLocalInput(c.startsAt),
        endsAt: toLocalInput(c.endsAt),
        usageLimit: c.usageLimit ? String(c.usageLimit) : "",
      }
    : { id: null, code: "", type: "percent", value: "10", minSubtotal: "0", active: true, startsAt: "", endsAt: "", usageLimit: "" };
}

export function CouponsSection() {
  const client = useQueryClient();
  const toast = useToast();
  const list = useAdminGet<AdminCoupon[]>("/admin/coupons", ["coupons"]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<AdminCoupon | null>(null);

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = {
        code: d.code.trim().toUpperCase(),
        type: d.type,
        value: Number(d.value),
        minSubtotal: Number(d.minSubtotal) || 0,
        active: d.active,
        startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : null,
        endsAt: d.endsAt ? new Date(d.endsAt).toISOString() : null,
        usageLimit: d.usageLimit ? Number(d.usageLimit) : null,
      };
      return d.id ? api<AdminCoupon>(`/admin/coupons/${d.id}`, { method: "PATCH", body }) : api<AdminCoupon>("/admin/coupons", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success("Coupon saved.");
      setDraft(null);
      void client.invalidateQueries({ queryKey: ["admin", "coupons"] });
    },
    onError: (err) => toast.error(adminErrorText(err)),
  });

  const remove = useMutation({
    mutationFn: (c: AdminCoupon) => api<void>(`/admin/coupons/${c.id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleting(null);
      toast.success("Coupon deleted.");
      void client.invalidateQueries({ queryKey: ["admin", "coupons"] });
    },
    onError: (err) => {
      setDeleting(null);
      toast.error(adminErrorText(err));
    },
  });

  const columns: Column<AdminCoupon>[] = [
    {
      header: "Code",
      cell: (c) => (
        <>
          <span className="adm-cell-strong adm-mono">{c.code}</span>
          <span className="adm-cell-sub">{c.type === "percent" ? `${c.value}% off` : `${formatAmd(c.value)} off`}</span>
        </>
      ),
    },
    { header: "Min. subtotal", cell: (c) => <span className="adm-money">{c.minSubtotal ? formatAmd(c.minSubtotal) : "any"}</span>, align: "num", hideBelow: "sm" },
    {
      header: "Used",
      cell: (c) => {
        const limit = c.usageLimit ?? 0;
        const pct = limit ? Math.min(100, Math.round((c.usedCount / limit) * 100)) : 0;
        return (
          <span style={{ minWidth: 96, display: "inline-block" }}>
            <span className="adm-cell-sub" style={{ display: "block" }}>
              {c.usedCount}
              {limit ? ` of ${limit}` : " · no limit"}
            </span>
            {limit ? (
              <span className="adm-meter" aria-hidden>
                <span style={{ width: `${pct}%` }} />
              </span>
            ) : null}
          </span>
        );
      },
      hideBelow: "md",
    },
    {
      header: "Window",
      cell: (c) => (
        <>
          <span>{c.startsAt ? formatDateTime(c.startsAt) : "any time"}</span>
          <span className="adm-cell-sub">{c.endsAt ? `until ${formatDateTime(c.endsAt)}` : "no end date"}</span>
        </>
      ),
      hideBelow: "lg",
    },
    { header: "Status", cell: (c) => <ActivePill active={c.active} /> },
    {
      header: "Actions",
      align: "actions",
      cell: (c) => (
        <span className="adm-rowactions" style={{ justifyContent: "flex-end" }}>
          <Button size="sm" variant="quiet" onClick={() => setDraft(toDraft(c))} data-testid={`edit-${c.id}`}>
            <Pencil aria-hidden /> Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleting(c)} data-testid={`delete-${c.id}`}>
            <Trash2 aria-hidden /> Delete
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageTitle
        description="Discount codes customers enter at checkout. Both the window and the usage limit are enforced by the server."
        actions={
          <Button variant="primary" onClick={() => setDraft(toDraft())} data-testid="new-coupon">
            <Plus aria-hidden /> New coupon
          </Button>
        }
      >
        Coupons
      </PageTitle>
      <Panel flush>
        <AdminTable
          testId="admin-coupons"
          query={list}
          rowKey={(c) => c.id}
          columns={columns}
          caption="Coupons"
          empty="No coupons yet."
          emptyBody="Create a code to offer a percentage or fixed discount at checkout."
          emptyAction={
            <Button variant="primary" onClick={() => setDraft(toDraft())}>
              <Plus aria-hidden /> New coupon
            </Button>
          }
        />
      </Panel>

      <AdminDialog
        open={draft !== null}
        wide
        testId="coupon-dialog"
        title={draft?.id ? `Edit ${draft.code}` : "New coupon"}
        description="Times use your browser's local time zone and are stored as UTC."
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setDraft(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="coupon-form" variant="primary" disabled={save.isPending || !draft} aria-busy={save.isPending} data-testid="save-coupon">
              {save.isPending ? "Saving…" : draft?.id ? "Save changes" : "Create coupon"}
            </Button>
          </>
        }
      >
        {draft ? (
          <form
            id="coupon-form"
            className="adm-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!save.isPending) save.mutate(draft);
            }}
          >
            {save.isError ? <AdminError error={save.error} /> : null}
            <div className="adm-grid md:grid-cols-2">
              <TextInput
                label="Code"
                value={draft.code}
                onChange={(code) => setDraft({ ...draft, code: code.toUpperCase().replace(/\s/g, "") })}
                required
                mono
                testId="coupon-code"
                hint="Customers type this at checkout."
              />
              <SelectInput
                label="Discount type"
                value={draft.type}
                onChange={(v) => setDraft({ ...draft, type: v as Draft["type"] })}
                options={[
                  { value: "percent", label: "Percent off" },
                  { value: "fixed", label: "Fixed amount (AMD)" },
                ]}
              />
              <TextInput
                label={draft.type === "percent" ? "Percent (1–100)" : "Amount (AMD)"}
                type="number"
                min={1}
                inputMode="numeric"
                value={draft.value}
                onChange={(value) => setDraft({ ...draft, value })}
                required
                testId="coupon-value"
              />
              <TextInput label="Minimum subtotal (AMD)" type="number" min={0} inputMode="numeric" value={draft.minSubtotal} onChange={(minSubtotal) => setDraft({ ...draft, minSubtotal })} hint="0 means no minimum." />
              <TextInput label="Starts" type="datetime-local" value={draft.startsAt} onChange={(startsAt) => setDraft({ ...draft, startsAt })} hint="Leave empty to allow immediately." />
              <TextInput label="Ends" type="datetime-local" value={draft.endsAt} onChange={(endsAt) => setDraft({ ...draft, endsAt })} hint="Leave empty for no expiry." />
              <TextInput label="Usage limit" type="number" min={1} inputMode="numeric" value={draft.usageLimit} onChange={(usageLimit) => setDraft({ ...draft, usageLimit })} hint="Total redemptions across all customers." />
              <div className="adm-field" style={{ justifyContent: "flex-end" }}>
                <span className="adm-label" aria-hidden>
                  Availability
                </span>
                <Toggle label="Active" checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} testId="coupon-active" />
              </div>
            </div>
            <p className="adm-hint">
              <BadgePercent aria-hidden width={13} height={13} style={{ display: "inline", verticalAlign: "-2px" }} /> A coupon with a future start date is saved but
              not yet redeemable.
            </p>
          </form>
        ) : null}
      </AdminDialog>

      <AdminConfirm
        open={deleting !== null}
        title={`Delete coupon ${deleting?.code}?`}
        body={<p className="adm-hint">Orders that already used it keep their discount. This cannot be undone.</p>}
        confirmLabel="Delete"
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
