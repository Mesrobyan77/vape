"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminUserRow } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { AdminConfirm, AdminDialog } from "../dialogs";
import { AdminTable, adminErrorText, Button, PageTitle, Panel, SearchField, StatusPill, TextInput, Toolbar, useAdminList, useUrlListState, type Column } from "../ui";
import { formatDateTime } from "./shared";

export function CustomersSection() {
  const client = useQueryClient();
  const toast = useToast();
  const defaults = useMemo(() => ({ page: 1, q: "" }), []);
  const { state, update, reset, isFiltered } = useUrlListState(defaults);
  const [toggle, setToggle] = useState<AdminUserRow | null>(null);
  const [reset2, setReset2] = useState<AdminUserRow | null>(null);
  const [code, setCode] = useState("");
  const list = useAdminList<AdminUserRow>("/admin/users", { page: state.page, pageSize: 20, q: state.q || undefined }, "users");

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
      setReset2(null);
      setCode("");
      void client.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => toast.error(adminErrorText(err)),
  });

  const columns: Column<AdminUserRow>[] = [
    {
      header: "Account",
      cell: (u) => (
        <>
          <span className="adm-cell-strong">{u.name}</span>
          <span className="adm-cell-sub">{u.email}</span>
        </>
      ),
    },
    { header: "Role", cell: (u) => (u.role === "admin" ? <StatusPill tone="accent">admin</StatusPill> : <StatusPill tone="neutral">customer</StatusPill>), hideBelow: "sm" },
    { header: "Orders", cell: (u) => u.orderCount, align: "num", hideBelow: "md" },
    {
      header: "MFA",
      cell: (u) => (u.role === "admin" ? (u.mfaEnabled ? <StatusPill tone="success">enabled</StatusPill> : <StatusPill tone="warning">not enrolled</StatusPill>) : <span className="adm-cell-sub">—</span>),
      hideBelow: "lg",
    },
    { header: "Created", cell: (u) => formatDateTime(u.createdAt), hideBelow: "lg" },
    { header: "Status", cell: (u) => (u.active ? <StatusPill tone="success">active</StatusPill> : <StatusPill tone="danger">deactivated</StatusPill>) },
    {
      header: "Actions",
      align: "actions",
      cell: (u) => (
        <span className="adm-rowactions" style={{ justifyContent: "flex-end" }}>
          <Button size="sm" onClick={() => setToggle(u)} data-testid={`toggle-${u.id}`}>
            {u.active ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
            {u.active ? "Deactivate" : "Reactivate"}
          </Button>
          {u.role === "admin" && u.mfaEnabled ? (
            <Button size="sm" variant="quiet" onClick={() => setReset2(u)} data-testid={`mfa-reset-${u.id}`}>
              <KeyRound aria-hidden /> Reset MFA
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageTitle description="Storefront accounts, and the admin staff accounts that sign in here.">Customers &amp; accounts</PageTitle>
      <Panel flush>
        <Toolbar>
          <SearchField label="Search" value={state.q} placeholder="Email or name" testId="users-search" onSubmit={(q) => update({ q, page: 1 })} />
          {isFiltered ? (
            <Button variant="quiet" onClick={reset} data-testid="users-clear">
              Clear search
            </Button>
          ) : null}
        </Toolbar>
        <AdminTable
          testId="admin-users"
          query={list}
          rowKey={(u) => u.id}
          columns={columns}
          caption="Accounts"
          onPage={(page) => update({ page })}
          empty={isFiltered ? "No accounts match that search." : "No accounts yet."}
          emptyBody={isFiltered ? "Search by the full email address, or clear the search." : "Accounts appear here when customers register or place an order."}
          emptyAction={isFiltered ? <Button onClick={reset}>Clear search</Button> : undefined}
        />
      </Panel>

      <AdminConfirm
        open={toggle !== null}
        title={toggle?.active ? `Deactivate ${toggle.email}?` : `Reactivate ${toggle?.email}?`}
        body={<p className="adm-hint">{toggle?.active ? "All of this account's sessions are revoked immediately." : "The customer will be able to sign in again."}</p>}
        danger={Boolean(toggle?.active)}
        confirmLabel={toggle?.active ? "Deactivate" : "Reactivate"}
        pending={setActive.isPending}
        onCancel={() => setToggle(null)}
        onConfirm={() => toggle && setActive.mutate(toggle)}
      />

      <AdminDialog
        open={reset2 !== null}
        testId="mfa-reset-dialog"
        title={reset2 ? `Reset MFA for ${reset2.email}` : "Reset MFA"}
        description="Step-up check: enter your own current authenticator code. This action is audit-logged."
        onClose={() => {
          setReset2(null);
          setCode("");
        }}
        footer={
          <>
            <Button
              variant="quiet"
              onClick={() => {
                setReset2(null);
                setCode("");
              }}
              disabled={mfaReset.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="mfa-reset-inputs"
              variant="danger"
              className="is-solid"
              disabled={mfaReset.isPending || code.trim().length < 6}
              aria-busy={mfaReset.isPending}
              data-testid="mfa-reset-submit"
            >
              {mfaReset.isPending ? "Resetting…" : "Reset MFA"}
            </Button>
          </>
        }
      >
        {mfaReset.isError ? (
          <p className="adm-alert is-error" role="alert">
            <ShieldCheck aria-hidden />
            {adminErrorText(mfaReset.error)}
          </p>
        ) : null}
        <form
          id="mfa-reset-inputs"
          onSubmit={(e) => {
            e.preventDefault();
            if (!mfaReset.isPending && reset2) mfaReset.mutate(reset2);
          }}
        >
          <TextInput label="Your 6-digit code" value={code} onChange={setCode} required inputMode="numeric" placeholder="123456" testId="mfa-reset-code" />
        </form>
      </AdminDialog>
    </>
  );
}
