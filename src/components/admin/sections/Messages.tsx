"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { ContactMessageRow } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { AdminTable, adminErrorText, PageTitle, Panel, SelectInput, useAdminList } from "../ui";
import { formatDateTime } from "./shared";

export function MessagesSection() {
  const client = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("new");
  const [open, setOpen] = useState<string | null>(null);
  const list = useAdminList<ContactMessageRow>("/admin/contact-messages", { page, pageSize: 20, status: status || undefined }, "messages");

  const update = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ContactMessageRow["status"] }) => api<void>(`/admin/contact-messages/${id}`, { method: "PATCH", body: { status: next } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["admin", "messages"] }),
    onError: (err) => toast.error(adminErrorText(err)),
  });

  return (
    <>
      <PageTitle>Contact messages</PageTitle>
      <Panel>
        <div className="mb-16 w-48">
          <SelectInput
            label="Status"
            value={status}
            onChange={(v) => {
              setPage(1);
              setStatus(v);
            }}
            options={[
              { value: "new", label: "New" },
              { value: "read", label: "Read" },
              { value: "archived", label: "Archived" },
              { value: "", label: "All" },
            ]}
          />
        </div>
        <AdminTable
          query={list}
          rowKey={(m) => m.id}
          empty="No messages."
          onPage={setPage}
          columns={[
            { header: "Received", cell: (m) => formatDateTime(m.createdAt) },
            { header: "From", cell: (m) => <span className="text-white">{m.name}<span className="block text-xs text-gray">{m.email} {m.phone}</span></span> },
            {
              header: "Message",
              cell: (m) => (
                <button type="button" className="text-left" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id}>
                  <span className="font-semibold text-white">{m.subject}</span>
                  <span className={`block whitespace-pre-wrap text-sm ${open === m.id ? "" : "line-clamp-1"}`}>{m.message}</span>
                </button>
              ),
            },
            {
              header: "Status",
              cell: (m) => (
                <select
                  className="field !h-9 text-sm"
                  aria-label={`Status for message from ${m.name}`}
                  value={m.status}
                  disabled={update.isPending}
                  onChange={(e) => update.mutate({ id: m.id, next: e.target.value as ContactMessageRow["status"] })}
                >
                  <option value="new">New</option>
                  <option value="read">Read</option>
                  <option value="archived">Archived</option>
                </select>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}
