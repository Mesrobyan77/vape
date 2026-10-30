"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MailOpen, Phone } from "lucide-react";
import { useMemo, useState } from "react";
import cn from "clsx";
import { api } from "@/lib/api/client";
import type { ContactMessageRow } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { AdminTable, adminErrorText, Button, PageTitle, Panel, SelectInput, StatusPill, Toolbar, useAdminList, useUrlListState, type Column } from "../ui";
import { formatDateTime, MessageStatusPill } from "./shared";

const FILTERS = [
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "archived", label: "Archived" },
  { value: "", label: "All" },
];

export function MessagesSection() {
  const client = useQueryClient();
  const toast = useToast();
  const defaults = useMemo(() => ({ page: 1, status: "new" }), []);
  const { state, update } = useUrlListState(defaults);
  const [expanded, setExpanded] = useState<string | null>(null);
  const list = useAdminList<ContactMessageRow>("/admin/contact-messages", { page: state.page, pageSize: 20, status: state.status || undefined }, "messages");
  const [busyId, setBusyId] = useState<string | null>(null);

  const updateStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ContactMessageRow["status"] }) =>
      api<void>(`/admin/contact-messages/${id}`, { method: "PATCH", body: { status: next } }),
    onMutate: ({ id }) => setBusyId(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin", "messages"] });
      setBusyId(null);
    },
    onError: (err) => {
      setBusyId(null);
      toast.error(adminErrorText(err));
    },
  });

  const columns: Column<ContactMessageRow>[] = [
    {
      header: "From",
      cell: (m) => (
        <>
          <span className={cn("adm-cell-strong", m.status === "new" && "is-unread")}>{m.name}</span>
          <span className="adm-cell-sub">
            <a href={`mailto:${m.email}`} className="adm-linkbtn is-muted" style={{ fontWeight: 500 }}>
              <MailOpen aria-hidden width={13} height={13} /> {m.email}
            </a>
          </span>
          {m.phone ? (
            <span className="adm-cell-sub">
              <Phone aria-hidden width={13} height={13} style={{ display: "inline", verticalAlign: "-2px" }} /> {m.phone}
            </span>
          ) : null}
        </>
      ),
    },
    {
      header: "Message",
      cell: (m) => {
        const open = expanded === m.id;
        return (
          <button
            type="button"
            className="adm-cell-toggle"
            onClick={() => setExpanded(open ? null : m.id)}
            aria-expanded={open}
            data-testid={`message-${m.id}`}
          >
            <span className="adm-cell-strong">{m.subject}</span>
            <span className={cn("adm-cell-sub", !open && "is-clamped")}>{m.message}</span>
          </button>
        );
      },
    },
    { header: "Received", cell: (m) => formatDateTime(m.createdAt), hideBelow: "sm" },
    {
      header: "Status",
      align: "actions",
      cell: (m) => (
        <span className="adm-rowactions" style={{ justifyContent: "flex-end" }}>
          <MessageStatusPill status={m.status} />
          <SelectInput
            label={`Status for message from ${m.name}`}
            hideLabel
            className="w-32"
            value={m.status}
            disabled={busyId === m.id}
            onChange={(next) => updateStatus.mutate({ id: m.id, next: next as ContactMessageRow["status"] })}
            options={[
              { value: "new", label: "New" },
              { value: "read", label: "Read" },
              { value: "archived", label: "Archived" },
            ]}
          />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageTitle description="Questions sent from the storefront contact form. Opening a message marks nothing — set the status yourself.">Contact messages</PageTitle>
      <Panel flush>
        <Toolbar>
          <div className="adm-seg" role="group" aria-label="Filter by status" data-testid="messages-filter">
            {FILTERS.map((f) => (
              <button key={f.value || "all"} type="button" aria-pressed={state.status === f.value} onClick={() => update({ status: f.value, page: 1 })}>
                {f.label}
              </button>
            ))}
          </div>
          <span className="adm-toolbar-spacer" />
          {busyId ? (
            <span className="adm-toolbar-meta">
              <StatusPill tone="info">saving…</StatusPill>
            </span>
          ) : null}
        </Toolbar>
        <AdminTable
          testId="admin-messages"
          query={list}
          rowKey={(m) => m.id}
          columns={columns}
          caption="Contact messages"
          onPage={(page) => update({ page })}
          empty={state.status ? "No messages with this status." : "No messages."}
          emptyBody="When a visitor sends the contact form it lands here."
          emptyAction={
            state.status ? (
              <Button onClick={() => update({ status: "", page: 1 })}>Show all messages</Button>
            ) : undefined
          }
        />
      </Panel>
    </>
  );
}
