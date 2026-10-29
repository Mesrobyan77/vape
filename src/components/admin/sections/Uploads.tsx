"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminImage, MediaRow } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminTable, adminErrorText, ImagesEditor, PageTitle, Panel, useAdminList } from "../ui";
import { formatDateTime } from "./shared";

export function UploadsSection() {
  const client = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<AdminImage[]>([]);
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

  return (
    <>
      <PageTitle>Uploads</PageTitle>
      <div className="space-y-6">
        <Panel title="Upload">
          <ImagesEditor
            label="New uploads"
            images={pending}
            onChange={(imgs) => {
              setPending(imgs);
              void client.invalidateQueries({ queryKey: ["admin", "uploads"] });
            }}
          />
          <p className="mt-2 text-xs">
            Files are validated by content (magic bytes) and dimensions on the server, then stored in Cloudinary. If Cloudinary is not configured the server
            responds “Uploads are not configured”.
          </p>
        </Panel>
        <Panel title="Media library">
          <AdminTable
            query={list}
            rowKey={(m) => m.id}
            empty="No uploaded media."
            onPage={setPage}
            columns={[
              {
                header: "Preview",
                // eslint-disable-next-line @next/next/no-img-element -- Cloudinary thumbnail
                cell: (m) => <img src={m.url} alt="" className="h-14 w-14 object-contain" />,
              },
              { header: "Public id", cell: (m) => <span className="break-all font-mono text-xs">{m.publicId}</span> },
              { header: "Size", cell: (m) => `${m.width}×${m.height} · ${(m.bytes / 1024).toFixed(0)} KB` },
              { header: "Uploaded", cell: (m) => formatDateTime(m.createdAt) },
              {
                header: "",
                cell: (m) => (
                  <span className="flex gap-3">
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        void navigator.clipboard?.writeText(m.url);
                        toast.info("URL copied.");
                      }}
                    >
                      Copy URL
                    </button>
                    <button type="button" className="text-link !text-danger" onClick={() => setDeleting(m)}>
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
        title="Delete this image?"
        body={<p>Make sure no product, category or banner still uses it.</p>}
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
