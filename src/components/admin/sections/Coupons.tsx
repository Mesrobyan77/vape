"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminCoupon } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { useToast } from "@/components/providers/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminError, AdminTable, adminErrorText, PageTitle, Panel, SaveBar, SelectInput, TextInput, Toggle, useAdminGet } from "../ui";
import { formatDateTime } from "./shared";

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
    ? { id: c.id, code: c.code, type: c.type, value: String(c.value), minSubtotal: String(c.minSubtotal), active: c.active, startsAt: toLocalInput(c.startsAt), endsAt: toLocalInput(c.endsAt), usageLimit: c.usageLimit ? String(c.usageLimit) : "" }
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

  return (
    <>
      <PageTitle actions={<button type="button" className="cus-btn is-filled is-sm" onClick={() => setDraft(toDraft())}>New coupon</button>}>Coupons</PageTitle>
      <div className="space-y-6">
        {draft ? (
          <Panel title={draft.id ? `Edit ${draft.code}` : "New coupon"}>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!save.isPending) save.mutate(draft);
              }}
            >
              {save.isError ? <AdminError error={save.error} /> : null}
              <div className="grid gap-4 md:grid-cols-4">
                <TextInput label="Code" value={draft.code} onChange={(code) => setDraft({ ...draft, code })} required />
                <SelectInput label="Type" value={draft.type} onChange={(v) => setDraft({ ...draft, type: v as Draft["type"] })} options={[{ value: "percent", label: "Percent" }, { value: "fixed", label: "Fixed AMD" }]} />
                <TextInput label={draft.type === "percent" ? "Percent (1–100)" : "Amount (AMD)"} type="number" min={1} value={draft.value} onChange={(value) => setDraft({ ...draft, value })} required />
                <TextInput label="Minimum subtotal (AMD)" type="number" min={0} value={draft.minSubtotal} onChange={(minSubtotal) => setDraft({ ...draft, minSubtotal })} />
                <TextInput label="Starts" type="datetime-local" value={draft.startsAt} onChange={(startsAt) => setDraft({ ...draft, startsAt })} />
                <TextInput label="Ends" type="datetime-local" value={draft.endsAt} onChange={(endsAt) => setDraft({ ...draft, endsAt })} />
                <TextInput label="Usage limit" type="number" min={1} value={draft.usageLimit} onChange={(usageLimit) => setDraft({ ...draft, usageLimit })} />
                <div className="flex items-end pb-3">
                  <Toggle label="Active" checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} />
                </div>
              </div>
              <SaveBar pending={save.isPending} onCancel={() => setDraft(null)} />
            </form>
          </Panel>
        ) : null}
        <Panel>
          <AdminTable
            query={list}
            rowKey={(c) => c.id}
            empty="No coupons."
            columns={[
              { header: "Code", cell: (c) => <span className="font-mono text-white">{c.code}</span> },
              { header: "Discount", cell: (c) => (c.type === "percent" ? `${c.value}%` : formatAmd(c.value)) },
              { header: "Min.", cell: (c) => formatAmd(c.minSubtotal) },
              { header: "Used", cell: (c) => `${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ""}` },
              { header: "Window", cell: (c) => `${formatDateTime(c.startsAt)} – ${formatDateTime(c.endsAt)}` },
              { header: "Active", cell: (c) => (c.active ? "Yes" : "No") },
              {
                header: "Actions",
                cell: (c) => (
                  <span className="flex gap-3">
                    <button type="button" className="text-link" onClick={() => setDraft(toDraft(c))}>Edit</button>
                    <button type="button" className="text-link !text-danger" onClick={() => setDeleting(c)}>Delete</button>
                  </span>
                ),
              },
            ]}
          />
        </Panel>
      </div>
      <ConfirmDialog open={deleting !== null} title={`Delete coupon ${deleting?.code}?`} pending={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => deleting && remove.mutate(deleting)} />
    </>
  );
}
