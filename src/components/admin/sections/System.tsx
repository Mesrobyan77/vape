"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import type { AuditLogRow, PaymentProviderStatus } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { AdminError, AdminTable, adminErrorText, PageTitle, Panel, TextInput, useAdminGet, useAdminList } from "../ui";
import { formatDateTime } from "./shared";

export function PaymentsSection() {
  const q = useAdminGet<PaymentProviderStatus[]>("/admin/payments/providers", ["providers"]);
  return (
    <>
      <PageTitle>Payment providers</PageTitle>
      <Panel>
        {q.isError ? <AdminError error={q.error} onRetry={() => q.refetch()} /> : null}
        <AdminTable
          query={q}
          rowKey={(p) => p.method}
          empty="No providers."
          columns={[
            { header: "Method", cell: (p) => <span className="text-white">{p.method}</span> },
            { header: "Configured", cell: (p) => (p.configured ? "Yes" : "No") },
            { header: "Enabled at checkout", cell: (p) => (p.enabled ? <span className="text-success">Yes</span> : <span className="text-gray">No</span>) },
            { header: "Mode", cell: (p) => p.mode },
            { header: "Notes", cell: (p) => p.note },
          ]}
        />
        <p className="mt-3 text-xs">Credentials are never shown here. Configure providers through server environment variables (see docs/payment-integrations.md).</p>
      </Panel>
    </>
  );
}

export function AuditSection() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [filter, setFilter] = useState("");
  const list = useAdminList<AuditLogRow>("/admin/audit-logs", { page, pageSize: 30, action: filter || undefined }, "audit");
  return (
    <>
      <PageTitle>Audit log</PageTitle>
      <Panel>
        <form
          className="mb-16 flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setFilter(action.trim());
          }}
        >
          <div className="w-64">
            <TextInput label="Action (e.g. order.transition)" value={action} onChange={setAction} />
          </div>
          <button type="submit" className="cus-btn is-sm">
            Filter
          </button>
        </form>
        <AdminTable
          testId="admin-audit"
          query={list}
          rowKey={(r) => r.id}
          empty="No audit entries."
          onPage={setPage}
          columns={[
            { header: "When", cell: (r) => formatDateTime(r.createdAt) },
            { header: "Actor", cell: (r) => r.actorEmail ?? "system" },
            { header: "Action", cell: (r) => <span className="font-mono text-xs text-white">{r.action}</span> },
            { header: "Target", cell: (r) => `${r.targetType}${r.targetId ? ` · ${r.targetId}` : ""}` },
            {
              header: "Changes",
              cell: (r) =>
                Object.keys(r.changes).length ? (
                  <details>
                    <summary className="cursor-pointer text-xs">View</summary>
                    <pre className="max-w-[420px] overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(r.changes, null, 2)}</pre>
                  </details>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

export function SecuritySection() {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  const regenerate = async () => {
    setPending(true);
    try {
      const r = await api<{ recoveryCodes: string[] }>("/auth/mfa/recovery-codes", { method: "POST", body: { code: code.trim() } });
      setCodes(r.recoveryCodes);
      setCode("");
      toast.success("New recovery codes generated. Old codes no longer work.");
    } catch (err) {
      toast.error(adminErrorText(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <PageTitle>Security</PageTitle>
      <Panel title="Recovery codes">
        <p className="mb-16 text-sm">Generating new codes invalidates all previous ones. Step-up verification with your current authenticator code is required.</p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) void regenerate();
          }}
        >
          <div className="w-48">
            <TextInput label="Authenticator code" value={code} onChange={setCode} required />
          </div>
          <button type="submit" className="cus-btn is-sm is-filled" disabled={pending}>
            {pending ? "Generating…" : "Regenerate codes"}
          </button>
        </form>
        {codes ? (
          <ul className="mt-4 grid max-w-[420px] grid-cols-2 gap-2 rounded-[5px] bg-black p-4 font-mono text-sm text-white">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </>
  );
}
