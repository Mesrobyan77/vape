"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminImage, MediaRow } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { AdminConfirm } from "../dialogs";
import { adminErrorText, Button, ImagesEditor, PageTitle, Pager, Panel, useAdminList } from "../ui";
import { formatDateTime } from "./shared";

export function UploadsSection() {
  const client = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState<AdminImage[]>([]);
  const [deleting, setDeleting] = useState<MediaRow | null>(null);
  const list = useAdminList<MediaRow>("/admin/uploads", { page, pageSize: 24 }, "uploads");

  const remove = useMutation({
    mutationFn: (m: MediaRow) => api<void>(`/admin/uploads/${m.id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleting(null);
      toast.success("Image deleted from Cloudinary.");
      void client.invalidateQueries({ queryKey: ["admin", "uploads"] });
    },
    onError: (err) => {
      setDeleting(null);
      toast.error(adminErrorText(err));
    },
  });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      toast.info("URL copied.");
      window.setTimeout(() => setCopied((c) => (c === url ? null : c)), 2000);
    } catch {
      toast.error("Your browser blocked clipboard access — copy it from the field instead.");
    }
  };

  const rows = (list.data?.data ?? []) as MediaRow[];

  return (
    <>
      <PageTitle description="Images stored in Cloudinary. Uploading saves immediately — there is no separate publish step.">Uploads</PageTitle>
      <div className="adm-stack">
        <Panel title="Upload an image" subtitle="Files are validated by content and dimensions on the server">
          <ImagesEditor
            label="New uploads"
            images={justUploaded}
            onChange={(imgs) => {
              setJustUploaded(imgs);
              void client.invalidateQueries({ queryKey: ["admin", "uploads"] });
            }}
          />
          <p className="adm-hint">
            If Cloudinary is not configured the server responds “Uploads are not configured”. Use the “Add by URL” field to reference an existing /media path
            without uploading a new file.
          </p>
        </Panel>

        <Panel title="Media library" subtitle={list.data ? `${list.data.meta.total} stored images` : undefined} flush>
          {list.isPending ? (
            <div className="adm-tiles p-5" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="adm-skeleton aspect-square" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="adm-hint p-5">No uploaded media yet. Images you add here appear in product, category and banner pickers.</p>
          ) : (
            <ul className="adm-tiles p-5">
              {rows.map((m) => (
                <li className="adm-tile" key={m.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary thumbnail */}
                  <img src={m.url} alt="" loading="lazy" />
                  <span className="adm-cell-sub" style={{ lineHeight: 1.35 }}>
                    {m.width}×{m.height} · {(m.bytes / 1024).toFixed(0)} KB
                    <br />
                    {formatDateTime(m.createdAt)}
                  </span>
                  <span className="adm-tile-row">
                    <Button size="sm" variant="quiet" onClick={() => void copy(m.url)} aria-label={`Copy URL for ${m.publicId}`}>
                      {copied === m.url ? <Check aria-hidden /> : <Copy aria-hidden />}
                      {copied === m.url ? "Copied" : "Copy"}
                    </Button>
                    <button
                      type="button"
                      className="adm-iconbtn"
                      style={{ marginLeft: "auto" }}
                      onClick={() => setDeleting(m)}
                      aria-label={`Delete ${m.publicId}`}
                      data-testid={`delete-${m.id}`}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Pager meta={list.data?.meta ?? null} onPage={setPage} busy={list.isFetching} />
        </Panel>
      </div>

      <AdminConfirm
        open={deleting !== null}
        title="Delete this image?"
        body={<p className="adm-hint">Make sure no product, category or banner still uses it — the storefront will show a broken image otherwise.</p>}
        confirmLabel="Delete image"
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
