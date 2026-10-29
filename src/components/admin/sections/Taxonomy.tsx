"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminBrand, AdminCategory, AdminImage, Localized } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminError, AdminTable, adminErrorText, emptyLocalized, ImagesEditor, LocalizedFields, PageTitle, Panel, SaveBar, TextInput, Toggle, useAdminGet } from "../ui";

type Kind = "categories" | "brands";
type Row = AdminCategory | AdminBrand;

interface Draft {
  id: string | null;
  slug: string;
  name: Localized;
  brandName: string;
  description: Localized;
  image: AdminImage | null;
  sortOrder: string;
  active: boolean;
}

function toDraft(kind: Kind, row?: Row): Draft {
  if (!row) return { id: null, slug: "", name: emptyLocalized(), brandName: "", description: emptyLocalized(), image: null, sortOrder: "0", active: true };
  if (kind === "categories") {
    const c = row as AdminCategory;
    return { id: c.id, slug: c.slug, name: c.name, brandName: "", description: c.description, image: c.image, sortOrder: String(c.sortOrder), active: c.active };
  }
  const b = row as AdminBrand;
  return { id: b.id, slug: b.slug, name: emptyLocalized(), brandName: b.name, description: emptyLocalized(), image: b.logo, sortOrder: String(b.sortOrder), active: b.active };
}

export function TaxonomySection({ kind }: { kind: Kind }) {
  const client = useQueryClient();
  const toast = useToast();
  const list = useAdminGet<Row[]>(`/admin/${kind}`, [kind]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const title = kind === "categories" ? "Categories" : "Brands";

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body =
        kind === "categories"
          ? { slug: d.slug.trim(), name: d.name, description: d.description, image: d.image, sortOrder: Number(d.sortOrder) || 0, active: d.active }
          : { slug: d.slug.trim(), name: d.brandName.trim(), logo: d.image, sortOrder: Number(d.sortOrder) || 0, active: d.active };
      return d.id ? api<Row>(`/admin/${kind}/${d.id}`, { method: "PATCH", body }) : api<Row>(`/admin/${kind}`, { method: "POST", body });
    },
    onSuccess: () => {
      toast.success("Saved.");
      setDraft(null);
      void client.invalidateQueries({ queryKey: ["admin", kind] });
    },
    onError: (err) => toast.error(adminErrorText(err)),
  });

  const remove = useMutation({
    mutationFn: (row: Row) => api<void>(`/admin/${kind}/${row.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Deleted.");
      setDeleting(null);
      void client.invalidateQueries({ queryKey: ["admin", kind] });
    },
    onError: (err) => {
      setDeleting(null);
      toast.error(adminErrorText(err));
    },
  });

  return (
    <>
      <PageTitle actions={<button type="button" className="cus-btn is-filled is-sm" onClick={() => setDraft(toDraft(kind))}>New</button>}>{title}</PageTitle>
      <div className="space-y-6">
        {draft ? (
          <Panel title={draft.id ? "Edit" : "Create"}>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!save.isPending) save.mutate(draft);
              }}
            >
              {save.isError ? <AdminError error={save.error} /> : null}
              <div className="grid gap-4 md:grid-cols-3">
                <TextInput label="Slug" value={draft.slug} onChange={(slug) => setDraft({ ...draft, slug })} required />
                <TextInput label="Sort order" type="number" value={draft.sortOrder} onChange={(sortOrder) => setDraft({ ...draft, sortOrder })} />
                <div className="flex items-end pb-3">
                  <Toggle label="Active" checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} />
                </div>
              </div>
              {kind === "categories" ? (
                <>
                  <LocalizedFields label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} required />
                  <LocalizedFields label="Description" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
                </>
              ) : (
                <TextInput label="Brand name" value={draft.brandName} onChange={(brandName) => setDraft({ ...draft, brandName })} required />
              )}
              <ImagesEditor
                label={kind === "categories" ? "Image" : "Logo"}
                images={draft.image ? [draft.image] : []}
                onChange={(imgs) => setDraft({ ...draft, image: imgs[0] ?? null })}
                max={1}
              />
              <SaveBar pending={save.isPending} onCancel={() => setDraft(null)} />
            </form>
          </Panel>
        ) : null}
        <Panel>
          <AdminTable
            query={list}
            rowKey={(r) => r.id}
            empty={`No ${title.toLowerCase()} yet.`}
            columns={[
              { header: "Name", cell: (r) => <span className="text-white">{"logo" in r ? r.name : r.name.en || r.name.hy}</span> },
              { header: "Slug", cell: (r) => r.slug },
              { header: "Order", cell: (r) => r.sortOrder },
              { header: "Active", cell: (r) => (r.active ? "Yes" : "No") },
              {
                header: "Actions",
                cell: (r) => (
                  <span className="flex gap-3">
                    <button type="button" className="text-link" onClick={() => setDraft(toDraft(kind, r))}>
                      Edit
                    </button>
                    <button type="button" className="text-link !text-danger" onClick={() => setDeleting(r)}>
                      Delete
                    </button>
                  </span>
                ),
              },
            ]}
          />
        </Panel>
      </div>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this entry?"
        body={<p>Entries still used by products cannot be deleted — deactivate them instead.</p>}
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
