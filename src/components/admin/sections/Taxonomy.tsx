"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminBrand, AdminCategory, AdminImage, Localized } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { AdminConfirm, AdminDialog } from "../dialogs";
import { AdminError, AdminTable, adminErrorText, Button, emptyLocalized, ImagesEditor, LocalizedFields, PageTitle, Panel, TextInput, Toggle, useAdminGet, type Column } from "../ui";
import { ActivePill } from "./shared";

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
  const isCategories = kind === "categories";
  const title = isCategories ? "Categories" : "Brands";

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = isCategories
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

  const columns: Column<Row>[] = [
    {
      header: isCategories ? "Category" : "Brand",
      cell: (r) => {
        const thumb = "logo" in r ? r.logo : r.image;
        const label = "logo" in r ? r.name : r.name.en || r.name.hy;
        return (
          <span className="adm-rowactions" style={{ gap: "var(--adm-sp-3)", justifyContent: "flex-start" }}>
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- taxonomy image from the media CDN
              <img src={thumb.url} alt="" className="adm-thumb" width={40} height={40} />
            ) : (
              <span className="adm-thumb" aria-hidden />
            )}
            <span>
              <span className="adm-cell-strong">{label}</span>
              <span className="adm-cell-sub adm-mono">{r.slug}</span>
            </span>
          </span>
        );
      },
    },
    { header: "Order", cell: (r) => r.sortOrder, align: "num", hideBelow: "sm" },
    { header: "Status", cell: (r) => <ActivePill active={r.active} /> },
    {
      header: "Actions",
      align: "actions",
      cell: (r) => (
        <span className="adm-rowactions" style={{ justifyContent: "flex-end" }}>
          <Button size="sm" variant="quiet" onClick={() => setDraft(toDraft(kind, r))} data-testid={`edit-${r.id}`}>
            <Pencil aria-hidden /> Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleting(r)} data-testid={`delete-${r.id}`}>
            <Trash2 aria-hidden /> Delete
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageTitle
        description={isCategories ? "Groups products in the storefront catalogue and filters." : "Manufacturers shown on the storefront brand strip."}
        actions={
          <Button variant="primary" onClick={() => setDraft(toDraft(kind))} data-testid="new-taxonomy">
            <Plus aria-hidden /> New {isCategories ? "category" : "brand"}
          </Button>
        }
      >
        {title}
      </PageTitle>
      <Panel flush>
        <AdminTable
          testId={`admin-${kind}`}
          query={list}
          rowKey={(r) => r.id}
          columns={columns}
          caption={title}
          empty={`No ${title.toLowerCase()} yet.`}
          emptyBody="Categories and brands are used to group products; add one, then assign products to it."
          emptyAction={
            <Button variant="primary" onClick={() => setDraft(toDraft(kind))}>
              <Plus aria-hidden /> New {isCategories ? "category" : "brand"}
            </Button>
          }
        />
      </Panel>

      <AdminDialog
        open={draft !== null}
        wide
        testId={`taxonomy-dialog-${kind}`}
        title={draft?.id ? `Edit ${isCategories ? "category" : "brand"}` : `New ${isCategories ? "category" : "brand"}`}
        description="The slug is used in storefront URLs; changing it breaks existing links."
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setDraft(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={`taxonomy-form-${kind}`}
              variant="primary"
              disabled={save.isPending || !draft}
              aria-busy={save.isPending}
              data-testid="save-taxonomy"
            >
              {save.isPending ? "Saving…" : draft?.id ? "Save changes" : "Create"}
            </Button>
          </>
        }
      >
        {draft ? (
          <form
            id={`taxonomy-form-${kind}`}
            className="adm-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!save.isPending) save.mutate(draft);
            }}
          >
            {save.isError ? <AdminError error={save.error} /> : null}
            <div className="adm-grid md:grid-cols-3">
              <TextInput label="Slug" value={draft.slug} onChange={(slug) => setDraft({ ...draft, slug })} required mono />
              <TextInput label="Sort order" type="number" inputMode="numeric" value={draft.sortOrder} onChange={(sortOrder) => setDraft({ ...draft, sortOrder })} hint="Lower numbers appear first." />
              <div className="adm-field" style={{ justifyContent: "flex-end" }}>
                <span className="adm-label" aria-hidden>
                  Visibility
                </span>
                <Toggle label="Active" checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} />
              </div>
            </div>
            {isCategories ? (
              <>
                <LocalizedFields label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} required />
                <LocalizedFields label="Description" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} multiline />
              </>
            ) : (
              <TextInput label="Brand name" value={draft.brandName} onChange={(brandName) => setDraft({ ...draft, brandName })} required />
            )}
            <ImagesEditor label={isCategories ? "Category image" : "Brand logo"} images={draft.image ? [draft.image] : []} onChange={(imgs) => setDraft({ ...draft, image: imgs[0] ?? null })} max={1} />
            <p className="adm-hint">Entries still used by products cannot be deleted — deactivate them instead.</p>
          </form>
        ) : null}
      </AdminDialog>

      <AdminConfirm
        open={deleting !== null}
        title={`Delete “${deleting ? ("logo" in deleting ? deleting.name : deleting.name.en || deleting.name.hy) : ""}”?`}
        body={<p className="adm-hint">Entries still used by products cannot be deleted — deactivate them instead.</p>}
        confirmLabel="Delete"
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
