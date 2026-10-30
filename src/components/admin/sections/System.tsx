"use client";

import { Code2, Copy, KeyRound } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import type { AuditLogRow, PaymentProviderStatus } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { AdminDialog } from "../dialogs";
import {
  AdminTable,
  adminErrorText,
  Button,
  PageTitle,
  Panel,
  SearchField,
  StatusPill,
  TextInput,
  Toolbar,
  useAdminGet,
  useAdminList,
  useUrlListState,
  type Column,
} from "../ui";
import { formatDateTime } from "./shared";

export function PaymentsSection() {
  const q = useAdminGet<PaymentProviderStatus[]>("/admin/payments/providers", ["providers"]);

  const columns: Column<PaymentProviderStatus>[] = [
    { header: "Method", cell: (p) => <span className="adm-cell-strong">{p.method}</span> },
    {
      header: "Credentials",
      cell: (p) => <StatusPill tone={p.configured ? "success" : "neutral"}>{p.configured ? "configured" : "not configured"}</StatusPill>,
    },
    {
      header: "At checkout",
      cell: (p) => <StatusPill tone={p.enabled ? "success" : "neutral"}>{p.enabled ? "offered" : "hidden"}</StatusPill>,
    },
    { header: "Mode", cell: (p) => <StatusPill tone={p.mode === "live" ? "accent" : "neutral"} dot={false}>{p.mode}</StatusPill>, hideBelow: "sm" },
    { header: "Notes", cell: (p) => <span className="adm-cell-sub" style={{ display: "block", maxWidth: "46ch" }}>{p.note || "—"}</span> },
  ];

  return (
    <>
      <PageTitle description="Which payment providers the storefront can offer, and whether their credentials are present.">Payment providers</PageTitle>
      <div className="adm-stack">
        <Panel flush>
          <AdminTable
            testId="admin-payments"
            query={q}
            rowKey={(p) => p.method}
            columns={columns}
            caption="Payment providers"
            empty="No providers."
            emptyBody="Payment providers are registered by the server configuration."
          />
        </Panel>
        <Panel title="How providers are enabled">
          <p className="adm-hint">
            Credentials are never shown or edited here on purpose. Set them in server environment variables and the provider appears as configured; the
            checkout then offers it. Cash on delivery always works and needs no credentials. See <code className="adm-mono">docs/payment-integrations.md</code>.
          </p>
        </Panel>
      </div>
    </>
  );
}

export function AuditSection() {
  const defaults = useMemo(() => ({ page: 1, action: "" }), []);
  const { state, update, reset, isFiltered } = useUrlListState(defaults);
  const list = useAdminList<AuditLogRow>("/admin/audit-logs", { page: state.page, pageSize: 30, action: state.action || undefined }, "audit");
  const [detail, setDetail] = useState<AuditLogRow | null>(null);

  const columns: Column<AuditLogRow>[] = [
    { header: "When", cell: (r) => formatDateTime(r.createdAt), hideBelow: "sm" },
    { header: "Actor", cell: (r) => <span className="adm-cell-strong">{r.actorEmail ?? "system"}</span> },
    { header: "Action", cell: (r) => <span className="adm-mono">{r.action}</span> },
    {
      header: "Target",
      cell: (r) => (
        <>
          <span>{r.targetType}</span>
          {r.targetId ? <span className="adm-cell-sub adm-mono">{r.targetId}</span> : null}
        </>
      ),
      hideBelow: "lg",
    },
    {
      header: "Changes",
      align: "actions",
      cell: (r) =>
        Object.keys(r.changes).length ? (
          <Button size="sm" variant="quiet" onClick={() => setDetail(r)} data-testid={`audit-detail-${r.id}`}>
            <Code2 aria-hidden /> {Object.keys(r.changes).length} field{Object.keys(r.changes).length === 1 ? "" : "s"}
          </Button>
        ) : (
          <span className="adm-cell-sub">no payload</span>
        ),
    },
  ];

  return (
    <>
      <PageTitle description="Every state-changing action taken by an admin or by the system, newest first.">Audit log</PageTitle>
      <Panel flush>
        <Toolbar>
          <SearchField
            label="Filter by action"
            value={state.action}
            placeholder="For example order.transition"
            testId="audit-action"
            onSubmit={(action) => update({ action, page: 1 })}
          />
          {isFiltered ? (
            <Button variant="quiet" onClick={reset} data-testid="audit-clear">
              Clear filter
            </Button>
          ) : null}
        </Toolbar>
        <AdminTable
          testId="admin-audit"
          query={list}
          rowKey={(r) => r.id}
          columns={columns}
          caption="Audit entries"
          onPage={(page) => update({ page })}
          empty={isFiltered ? "No audit entries for that action." : "No audit entries."}
          emptyBody={isFiltered ? "Action names are matched exactly, for example order.transition." : "Entries appear as soon as someone changes data in admin."}
          emptyAction={isFiltered ? <Button onClick={reset}>Clear filter</Button> : undefined}
        />
      </Panel>

      <AdminDialog
        open={detail !== null}
        wide
        testId="audit-detail-dialog"
        title={detail ? detail.action : "Change"}
        description={detail ? `${detail.actorEmail ?? "system"} · ${formatDateTime(detail.createdAt)}${detail.targetId ? ` · ${detail.targetType} ${detail.targetId}` : ""}` : undefined}
        onClose={() => setDetail(null)}
        footer={
          <Button variant="quiet" onClick={() => setDetail(null)}>
            Close
          </Button>
        }
      >
        <pre className="adm-json">{detail ? JSON.stringify(detail.changes, null, 2) : ""}</pre>
      </AdminDialog>
    </>
  );
}

export function SecuritySection() {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const regenerate = async () => {
    setPending(true);
    setError(null);
    try {
      const r = await api<{ recoveryCodes: string[] }>("/auth/mfa/recovery-codes", { method: "POST", body: { code: code.trim() } });
      setCodes(r.recoveryCodes);
      setCode("");
      toast.success("New recovery codes generated. Old codes no longer work.");
    } catch (err) {
      setError(adminErrorText(err));
      toast.error(adminErrorText(err));
    } finally {
      setPending(false);
    }
  };

  const copyAll = async () => {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.info("Recovery codes copied.");
    } catch {
      toast.error("Your browser blocked clipboard access — copy them manually.");
    }
  };

  return (
    <>
      <PageTitle description="Second-factor recovery codes for your own administrator account.">Security</PageTitle>
      <div className="adm-stack">
        <Panel title="Recovery codes" subtitle="Each code can be used once, if you lose your authenticator">
          <div className="adm-stack">
            <p className="adm-hint">Generating new codes invalidates all previous ones. Step-up verification with your current authenticator code is required.</p>
            {error ? (
              <p className="adm-alert is-error" role="alert">
                {error}
              </p>
            ) : null}
            <form
              className="adm-grid md:grid-cols-[minmax(0,260px)_auto] items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (!pending) void regenerate();
              }}
            >
              <TextInput label="Authenticator code" value={code} onChange={setCode} required inputMode="numeric" placeholder="123456" testId="recovery-code-input" />
              <Button type="submit" variant="primary" disabled={pending || code.trim().length < 6} aria-busy={pending} data-testid="recovery-regenerate">
                <KeyRound aria-hidden /> {pending ? "Generating…" : "Regenerate codes"}
              </Button>
            </form>
          </div>
        </Panel>

        {codes ? (
          <Panel
            title="Your new recovery codes"
            subtitle="Store them in a password manager — they are shown only once"
            actions={
              <Button size="sm" onClick={() => void copyAll()}>
                <Copy aria-hidden /> Copy all
              </Button>
            }
          >
            <ul className="adm-codes" data-testid="recovery-codes-list">
              {codes.map((c) => (
                <li key={c} className="adm-mono">
                  {c}
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
