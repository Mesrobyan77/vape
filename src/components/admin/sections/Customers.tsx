"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminUserRow } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminTable, adminErrorText, PageTitle, Panel, TextInput, useAdminList } from "../ui";
import { formatDateTime } from "./shared";

export function CustomersSection() {
  const client = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [toggle, setToggle] = useState<AdminUserRow | null>(null);
  const [reset, setReset] = useState<AdminUserRow | null>(null);
  const [code, setCode] = useState("");
  const list = useAdminList<AdminUserRow>("/admin/users", { page, pageSize: 20, q: search || undefined }, "users");

  const setActive = useMutation({
    mutationFn: (u: AdminUserRow) => api<void>(`/admin/users/${u.id}`, { method: "PATCH", body: { active: !u.active } }),
    onSuccess: () => {
      toast.success("Account updated. Deactivated accounts are signed out everywhere.");
      setToggle(null);
      void client.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => {
      setToggle(null);
      toast.error(adminErrorText(err));
    },
  });

  const mfaReset = useMutation({
    mutationFn: (u: AdminUserRow) => api<void>(`/admin/users/${u.id}/mfa-reset`, { method: "POST", body: { code: code.trim() } }),
    onSuccess: () => {
      toast.success("MFA reset. The admin must enrol again at next sign-in.");
      setReset(null);
      setCode("");
      void client.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => toast.error(adminErrorText(err)),
  });

  return (
    <>
      <PageTitle>Customers</PageTitle>
      <Panel>
        <form
          className="mb-16 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q.trim());
          }}
        >
          <div className="w-72">
            <TextInput label="Search (email or name)" value={q} onChange={setQ} />
          </div>
          <button type="submit" className="cus-btn is-sm">
            Search
          </button>
        </form>
        <AdminTable
          testId="admin-users"
          query={list}
          rowKey={(u) => u.id}
          empty="No accounts found."
          onPage={setPage}
          columns={[
            { header: "Name", cell: (u) => <span className="text-white">{u.name}<span className="block text-xs text-gray">{u.email}</span></span> },
            { header: "Role", cell: (u) => u.role },
            { header: "Orders", cell: (u) => u.orderCount },
            { header: "MFA", cell: (u) => (u.role === "admin" ? (u.mfaEnabled ? "Enabled" : "Not enrolled") : "—") },
            { header: "Created", cell: (u) => formatDateTime(u.createdAt) },
            { header: "Status", cell: (u) => (u.active ? "Active" : <span className="text-danger">Deactivated</span>) },
            {
              header: "Actions",
              cell: (u) => (
                <span className="flex gap-3 whitespace-nowrap">
                  <button type="button" className="text-link" onClick={() => setToggle(u)}>
                    {u.active ? "Deactivate" : "Reactivate"}
                  </button>
                  {u.role === "admin" && u.mfaEnabled ? (
                    <button type="button" className="text-link" onClick={() => setReset(u)}>
                      Reset MFA
                    </button>
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      </Panel>
      <ConfirmDialog
        open={toggle !== null}
        title={toggle?.active ? `Deactivate ${toggle.email}?` : `Reactivate ${toggle?.email}?`}
        body={<p>{toggle?.active ? "All of this account's sessions are revoked immediately." : "The customer will be able to sign in again."}</p>}
        danger={Boolean(toggle?.active)}
        pending={setActive.isPending}
        onCancel={() => setToggle(null)}
        onConfirm={() => toggle && setActive.mutate(toggle)}
      />
      {reset ? (
        <div className="fixed inset-0 z-[100002] grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="mfa-reset-title">
          <form
            className="w-full max-w-[440px] space-y-4 rounded-[10px] bg-surface p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!mfaReset.isPending) mfaReset.mutate(reset);
            }}
          >
            <h2 id="mfa-reset-title" className="h6 text-white">
              Reset MFA for {reset.email}
            </h2>
            <p className="text-sm">Step-up check: enter your own current authenticator code. This action is audit-logged.</p>
            <TextInput label="Your 6-digit code" value={code} onChange={setCode} required />
            <div className="flex gap-3">
              <button type="submit" className="cus-btn is-filled is-danger" disabled={mfaReset.isPending}>
                {mfaReset.isPending ? "Resetting…" : "Reset MFA"}
              </button>
              <button type="button" className="cus-btn" onClick={() => setReset(null)} disabled={mfaReset.isPending}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
