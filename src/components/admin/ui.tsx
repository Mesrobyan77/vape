"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ImagePlus, RefreshCw, Trash2, TriangleAlert, Upload } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { api, apiPage, isApiError, type ApiError } from "@/lib/api/client";
import type { AdminImage, Localized, MediaRow, PageMeta } from "@/lib/api/types";
import { LOCALES } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";

export const LOCALE_LABEL: Record<string, string> = { hy: "Armenian", ru: "Russian", en: "English" };

export function adminErrorText(error: unknown): string {
  if (!isApiError(error)) return "Unexpected error.";
  if (error.code === "NETWORK" || error.code === "TIMEOUT") return "Network problem — the change was not confirmed. Try again.";
  const details = error.fieldErrors.map((d) => `${d.path ?? "field"}: ${d.message ?? "invalid"}`).join("; ");
  return details ? `${error.message} (${details})` : error.message;
}

export function fieldError(error: unknown, path: string): string | undefined {
  if (!isApiError(error)) return undefined;
  return (error as ApiError).fieldErrors.find((d) => d.path === path || d.path?.startsWith(`${path}.`))?.message;
}

/** Paginated admin list with keep-previous-data, used by every table. */
export function useAdminList<T>(path: string, params: Record<string, string | number | undefined>, key: string) {
  return useQuery({
    queryKey: ["admin", key, params],
    queryFn: ({ signal }) => apiPage<T[]>(path, { query: params, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminGet<T>(path: string, key: unknown[], enabled = true) {
  return useQuery({ queryKey: ["admin", ...key], queryFn: ({ signal }) => api<T>(path, { signal }), enabled });
}

export function Panel({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="surface rounded-[10px] p-4 sm:p-6">
      {title || actions ? (
        <div className="mb-16 flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="h6 text-white">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function AdminTable<T>({
  columns,
  query,
  rowKey,
  empty,
  onPage,
  testId,
}: {
  columns: Column<T>[];
  query: { data?: { data: T[]; meta: PageMeta } | T[]; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => unknown; isPlaceholderData?: boolean };
  rowKey: (row: T) => string;
  empty: string;
  onPage?: (page: number) => void;
  testId?: string;
}) {
  if (query.isPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton h-11 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError && !query.data) return <AdminError error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const rows = Array.isArray(query.data) ? query.data : (query.data?.data ?? []);
  const meta = Array.isArray(query.data) ? null : (query.data?.meta ?? null);
  return (
    <div aria-busy={query.isFetching}>
      {query.isError ? <AdminError error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} compact /> : null}
      {rows.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-white/15 p-8 text-center" data-testid="admin-empty">
          {empty}
        </p>
      ) : (
        <div className={`overflow-x-auto transition-opacity ${query.isFetching && query.isPlaceholderData ? "opacity-60" : ""}`}>
          <table className="admin-table min-w-[640px]" data-testid={testId}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.header} scope="col" className={c.className}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((c) => (
                    <td key={c.header} className={c.className}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meta && onPage && meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <button type="button" className="cus-btn is-sm" disabled={meta.page <= 1 || query.isFetching} onClick={() => onPage(meta.page - 1)}>
            Previous
          </button>
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} total
          </span>
          <button type="button" className="cus-btn is-sm" disabled={meta.page >= meta.totalPages || query.isFetching} onClick={() => onPage(meta.page + 1)}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AdminError({ error, onRetry, retrying, compact }: { error: unknown; onRetry?: () => void; retrying?: boolean; compact?: boolean }) {
  return (
    <div role="alert" className={`form-alert is-error ${compact ? "mb-4" : ""}`} data-testid="admin-error">
      <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1">{adminErrorText(error)}</span>
      {onRetry ? (
        <button type="button" className="cus-btn is-sm" onClick={onRetry} disabled={retrying}>
          <RefreshCw className="!h-4 !w-4" aria-hidden /> Retry
        </button>
      ) : null}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  error,
  required,
  placeholder,
  min,
  max,
  step,
  hint,
  testId,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="form-group">
      <label htmlFor={id} className="field-label text-sm">
        {label}
        {required ? <span aria-hidden className="text-danger"> *</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        data-testid={testId}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1 text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="form-group">
      <label htmlFor={id} className="field-label text-sm">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Toggle({ label, checked, onChange, testId }: { label: string; checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <label className="checkbox-style">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      <span>{label}</span>
    </label>
  );
}

/** Edits a { hy, ru, en } value; Armenian is the required fallback language. */
export function LocalizedFields({
  label,
  value,
  onChange,
  multiline,
  required,
  error,
  testId,
}: {
  label: string;
  value: Localized;
  onChange: (value: Localized) => void;
  multiline?: boolean;
  required?: boolean;
  error?: string;
  testId?: string;
}) {
  const id = useId();
  return (
    <fieldset className="rounded-[10px] border border-white/10 p-3">
      <legend className="px-1 text-sm font-semibold text-white">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </legend>
      <div className={`grid gap-3 ${multiline ? "" : "md:grid-cols-3"}`}>
        {LOCALES.map((l) => (
          <div key={l} className="form-group">
            <label htmlFor={`${id}-${l}`} className="mb-1 block text-xs uppercase tracking-wide">
              {LOCALE_LABEL[l]} ({l})
            </label>
            {multiline ? (
              <textarea id={`${id}-${l}`} rows={5} value={value[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} lang={l} data-testid={testId ? `${testId}-${l}` : undefined} />
            ) : (
              <input id={`${id}-${l}`} type="text" value={value[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} lang={l} data-testid={testId ? `${testId}-${l}` : undefined} />
            )}
          </div>
        ))}
      </div>
      {error ? <p className="field-error">{error}</p> : null}
    </fieldset>
  );
}

export const emptyLocalized = (): Localized => ({ hy: "", ru: "", en: "" });

/** Image list editor: upload to Cloudinary via the admin API, or reference an existing /media path. */
export function ImagesEditor({ label, images, onChange, max = 12 }: { label: string; images: AdminImage[]; onChange: (images: AdminImage[]) => void; max?: number }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const [dims, setDims] = useState({ width: "800", height: "800" });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const media = await api<MediaRow>("/admin/uploads", { method: "POST", formData: form, timeoutMs: 60_000 });
      onChange([...images, { url: media.url, publicId: media.publicId, alt: emptyLocalized(), width: media.width, height: media.height }]);
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(`Upload failed: ${adminErrorText(err)}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addUrl = () => {
    const w = Number(dims.width);
    const h = Number(dims.height);
    if (!url.trim() || !w || !h) return;
    onChange([...images, { url: url.trim(), publicId: null, alt: emptyLocalized(), width: w, height: h }]);
    setUrl("");
  };

  return (
    <fieldset className="rounded-[10px] border border-white/10 p-3">
      <legend className="px-1 text-sm font-semibold text-white">{label}</legend>
      {images.length ? (
        <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`} className="rounded-[5px] border border-white/10 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary allowed sources */}
              <img src={img.url} alt={img.alt.en || img.alt.hy || ""} className="mb-2 aspect-square w-full object-contain" />
              <input
                type="text"
                aria-label={`Alt text (hy) for image ${i + 1}`}
                placeholder="Alt (hy)"
                value={img.alt.hy}
                className="field mb-2 !h-9 text-xs"
                onChange={(e) => onChange(images.map((x, j) => (j === i ? { ...x, alt: { ...x.alt, hy: e.target.value, en: x.alt.en || e.target.value } } : x)))}
              />
              <div className="flex justify-between gap-2 text-xs">
                <button
                  type="button"
                  className="text-link"
                  disabled={i === 0}
                  onClick={() => onChange(images.map((x, j) => (j === i - 1 ? images[i]! : j === i ? images[i - 1]! : x)))}
                >
                  ← Move
                </button>
                <button type="button" className="text-danger" onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label={`Remove image ${i + 1}`}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm">No images yet.</p>
      )}
      {images.length < max ? (
        <div className="flex flex-wrap items-end gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            id={`${label}-file`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <label htmlFor={`${label}-file`} className={`cus-btn is-sm cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`} aria-busy={uploading}>
            {uploading ? <span className="spinner" aria-hidden /> : <Upload className="!h-4 !w-4" aria-hidden />}
            {uploading ? "Uploading…" : "Upload image"}
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <input type="text" className="field !h-9 w-60 text-sm" placeholder="/media/products/p-01.png" aria-label="Image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <input type="number" className="field !h-9 w-20 text-sm" aria-label="Width" value={dims.width} onChange={(e) => setDims({ ...dims, width: e.target.value })} />
            <input type="number" className="field !h-9 w-20 text-sm" aria-label="Height" value={dims.height} onChange={(e) => setDims({ ...dims, height: e.target.value })} />
            <button type="button" className="cus-btn is-sm" onClick={addUrl}>
              <ImagePlus className="!h-4 !w-4" aria-hidden /> Add URL
            </button>
          </div>
        </div>
      ) : null}
      <p className="mt-2 text-xs">JPEG, PNG, WebP or AVIF up to 5 MB. URLs must be /media paths, Cloudinary or Pexels.</p>
    </fieldset>
  );
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-24 flex flex-wrap items-center justify-between gap-3">
      <h1 className="h4 text-white">{children}</h1>
      {actions}
    </div>
  );
}

export function StatCard({ label, value, tone }: { label: string; value: ReactNode; tone?: "warning" | "danger" }) {
  return (
    <div className={`surface rounded-[10px] p-5 ${tone === "danger" ? "ring-1 ring-danger/60" : tone === "warning" ? "ring-1 ring-warning/60" : ""}`}>
      <p className="mb-2 text-sm">{label}</p>
      <p className="h4 text-white">{value}</p>
    </div>
  );
}

export function SaveBar({ pending, onCancel, label = "Save", testId }: { pending: boolean; onCancel?: () => void; label?: string; testId?: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <button type="submit" className="cus-btn is-filled" disabled={pending} aria-busy={pending} data-testid={testId}>
        {pending ? <span className="spinner" aria-hidden /> : null}
        {pending ? "Saving…" : label}
      </button>
      {onCancel ? (
        <button type="button" className="cus-btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      ) : null}
    </div>
  );
}
