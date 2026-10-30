"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImagePlus, Inbox, RefreshCw, Search, Trash2, TriangleAlert, Upload, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import cn from "clsx";
import { api, apiPage, isApiError, type ApiError } from "@/lib/api/client";
import type { AdminImage, Localized, MediaRow, PageMeta } from "@/lib/api/types";
import { LOCALES } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";

export const LOCALE_LABEL: Record<string, string> = { hy: "Armenian", ru: "Russian", en: "English" };
/** Armenian is the catalogue's fallback language, so it is the one that must be filled in. */
const REQUIRED_LOCALE = "hy";

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

/**
 * Boolean preference kept in localStorage. Hydration-safe: the server snapshot is always the
 * default, and the stored value is read through useSyncExternalStore on the client only.
 */
export function useLocalFlag(key: string) {
  const subscribe = useCallback((onChange: () => void) => {
    const handler = () => onChange();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* storage blocked — the preference simply does not persist */
      }
      window.dispatchEvent(new StorageEvent("storage", { key }));
    },
    [key],
  );
  return [value, set] as const;
}

/**
 * List state mirrored into the URL so filters and page survive "back", a refresh and being
 * shared with another admin. Values equal to the default are omitted from the query string.
 */
export function useUrlListState<T extends Record<string, string | number>>(defaults: T) {
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = Object.fromEntries(
    Object.keys(defaults).map((k) => {
      const raw = params.get(k);
      const fallback = defaults[k as keyof T];
      if (raw === null) return [k, fallback];
      return [k, typeof fallback === "number" ? Number(raw) || fallback : raw];
    }),
  ) as T;

  const [state, setState] = useState<T>(initial);

  useEffect(() => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(state)) {
      if (value === "" || value === 0 || value === defaults[key as keyof T]) continue;
      query.set(key, String(value));
    }
    const qs = query.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [state, pathname, defaults]);

  const update = useCallback((patch: Partial<T>) => setState((prev) => ({ ...prev, ...patch })), []);
  const reset = useCallback(() => setState(defaults), [defaults]);
  return { state, update, reset, isFiltered: Object.keys(state).some((k) => state[k as keyof T] !== defaults[k as keyof T]) };
}

/* ---------------------------------------------------------------------- card */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  footer,
  flush,
  className,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("adm-card", className)}>
      {title || actions ? (
        <header className="adm-card-head">
          <div style={{ minWidth: 0 }}>
            {title ? <h2 className="adm-card-title">{title}</h2> : null}
            {subtitle ? <p className="adm-card-sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="adm-card-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("adm-card-body", flush && "is-flush")}>{children}</div>
      {footer ? <div className="adm-pager" style={{ borderTop: 0 }}>{footer}</div> : null}
    </section>
  );
}

/* --------------------------------------------------------------------- pills */

export type PillTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

export function StatusPill({ tone = "neutral", children, dot = true }: { tone?: PillTone; children: ReactNode; dot?: boolean }) {
  return <span className={cn("adm-pill", `is-${tone}`, !dot && "is-plain")}>{children}</span>;
}

/* --------------------------------------------------------------------- buttons */

export function Button({
  children,
  variant = "default",
  size,
  busy,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLButtonElement>;
  variant?: "default" | "primary" | "quiet" | "danger";
  size?: "sm" | "md" | "lg";
  busy?: boolean;
}) {
  return (
    <button
      type={rest.type ?? "button"}
      aria-busy={busy || undefined}
      className={cn("adm-btn", variant !== "default" && `is-${variant}`, size === "sm" && "is-sm", busy && "is-busy", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ page head */

export function PageTitle({ children, description, actions }: { children: ReactNode; description?: string; actions?: ReactNode }) {
  return (
    <div className="adm-page-head">
      <div className="adm-page-head-text">
        <h1 className="adm-page-title">{children}</h1>
        {description ? <p className="adm-page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="adm-page-actions">{actions}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- stat cards */

export function StatCard({
  label,
  value,
  tone,
  hint,
  href,
  icon,
}: {
  label: string;
  value: ReactNode;
  tone?: "warning" | "danger" | "ok";
  hint?: ReactNode;
  href?: string;
  icon?: ReactNode;
}) {
  const body = (
    <>
      <p className="adm-stat-label">
        {icon}
        {label}
      </p>
      <p className="adm-stat-value">{value}</p>
      {hint ? <p className="adm-stat-foot">{hint}</p> : null}
    </>
  );
  const cls = cn("adm-stat", tone && `is-${tone}`);
  if (!href) return <div className={cls}>{body}</div>;
  return (
    <Link href={href} className={cls} data-testid={`stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}>
      {body}
    </Link>
  );
}

/* ----------------------------------------------------------------- empty/error */

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="adm-empty" data-testid="admin-empty">
      <span className="adm-empty-icon">{icon ?? <Inbox aria-hidden />}</span>
      <h3 className="adm-empty-title">{title}</h3>
      {body ? <p className="adm-empty-body">{body}</p> : null}
      {action ? <div className="adm-empty-actions">{action}</div> : null}
    </div>
  );
}

export function AdminError({ error, onRetry, retrying, compact }: { error: unknown; onRetry?: () => void; retrying?: boolean; compact?: boolean }) {
  return (
    <div role="alert" className={cn("adm-alert is-error", compact ? "" : "mb-4")} data-testid="admin-error">
      <TriangleAlert aria-hidden />
      <span style={{ flex: 1 }}>{adminErrorText(error)}</span>
      {onRetry ? (
        <span className="adm-alert-actions">
          <Button size="sm" onClick={onRetry} disabled={retrying}>
            <RefreshCw aria-hidden /> Retry
          </Button>
        </span>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------- table */

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** "num" right-aligns and uses tabular figures; "actions" pins the cell to the right edge. */
  align?: "num" | "actions";
  hideBelow?: "sm" | "md" | "lg";
}

const HIDE_CLASS = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" } as const;

type ListQuery<T> = {
  data?: { data: T[]; meta: PageMeta } | T[];
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => unknown;
  isPlaceholderData?: boolean;
};

export function AdminTable<T>({
  columns,
  query,
  rowKey,
  empty,
  emptyBody,
  emptyAction,
  onPage,
  testId,
  caption,
}: {
  columns: Column<T>[];
  query: ListQuery<T>;
  rowKey: (row: T) => string;
  empty: string;
  emptyBody?: string;
  emptyAction?: ReactNode;
  onPage?: (page: number) => void;
  testId?: string;
  caption?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  if (query.isPending) return <TableSkeleton columns={columns.length} />;
  if (query.isError && !query.data) return <div className="p-4 sm:p-5"><AdminError error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} /></div>;

  const rows = Array.isArray(query.data) ? query.data : (query.data?.data ?? []);
  const meta = Array.isArray(query.data) ? null : (query.data?.meta ?? null);

  if (rows.length === 0) {
    return (
      <div className="p-2 sm:p-4">
        <EmptyState title={empty} body={emptyBody} action={emptyAction} />
      </div>
    );
  }

  return (
    <div aria-busy={query.isFetching}>
      {query.isError ? <div className="p-4 sm:p-5"><AdminError error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} compact /></div> : null}
      <div
        ref={wrapRef}
        className={cn("adm-tablewrap", scrolled && "is-scrolled")}
        onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 4)}
      >
        <table className="adm-table" data-testid={testId}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.header} scope="col" className={cn(c.align && `is-${c.align}`, c.hideBelow && HIDE_CLASS[c.hideBelow], c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.header} className={cn(c.align && `is-${c.align}`, c.hideBelow && HIDE_CLASS[c.hideBelow], c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="adm-scrollhint">
        <ChevronRight aria-hidden /> Scroll right for more columns
      </p>
      {meta && onPage ? <Pager meta={meta} onPage={onPage} busy={query.isFetching} /> : null}
    </div>
  );
}

export function Pager({ meta, onPage, busy }: { meta: PageMeta | null; onPage: (page: number) => void; busy?: boolean }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav className="adm-pager" aria-label="Pagination">
      <span>
        {meta.total} total · {meta.pageSize} per page
      </span>
      <span className="adm-pager-pages">
        <Button size="sm" disabled={meta.page <= 1 || busy} onClick={() => onPage(meta.page - 1)}>
          <ChevronLeft aria-hidden /> Previous
        </Button>
        <span className="adm-pager-pos">
          Page {meta.page} of {meta.totalPages}
        </span>
        <Button size="sm" disabled={meta.page >= meta.totalPages || busy} onClick={() => onPage(meta.page + 1)}>
          Next <ChevronRight aria-hidden />
        </Button>
      </span>
    </nav>
  );
}

function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <div className="p-4 sm:p-5" aria-busy="true" aria-label="Loading">
      <div className="adm-skeleton mb-3 h-3 w-32" />
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-3 border-b border-[color:var(--adm-border)] py-3 last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} className="adm-skeleton h-4" style={{ width: c === 0 ? "32%" : `${Math.max(8, 20 - c)}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- toolbar */

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <form
      className="adm-toolbar"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}

export function SearchField({
  label,
  value,
  onSubmit,
  testId,
  placeholder = "Search…",
}: {
  label: string;
  value: string;
  onSubmit: (value: string) => void;
  testId?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [seed, setSeed] = useState(value);
  if (seed !== value) {
    setSeed(value);
    setDraft(value);
  }
  const id = useId();
  return (
    <div className="adm-field" style={{ minWidth: 200, flex: "1 1 220px" }}>
      <label htmlFor={id} className="adm-label">
        {label}
      </label>
      <span className="adm-inputwrap">
        <Search aria-hidden />
        <input
          id={id}
          type="search"
          className="adm-input"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit(draft.trim());
            }
          }}
          data-testid={testId}
        />
        {draft ? (
          <button
            type="button"
            className="adm-iconbtn adm-clear"
            aria-label="Clear search"
            onClick={() => {
              setDraft("");
              onSubmit("");
            }}
          >
            <X aria-hidden />
          </button>
        ) : null}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------------- fields */

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
  mono,
  disabled,
  inputMode,
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
  mono?: boolean;
  disabled?: boolean;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email";
}) {
  const id = useId();
  return (
    <div className="adm-field">
      <label htmlFor={id} className="adm-label">
        {label}
        {required ? (
          <span className="is-required" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      <input
        id={id}
        type={type}
        className={cn("adm-input", mono && "is-mono", (type === "number" || inputMode === "numeric") && "is-num")}
        value={value}
        min={min}
        max={max}
        step={step}
        required={required}
        disabled={disabled}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        data-testid={testId}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="adm-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="adm-err">
          <TriangleAlert aria-hidden />
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
  hint,
  className,
  hideLabel,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  testId?: string;
  hint?: string;
  className?: string;
  /** Keeps the label for screen readers only — for controls inside dense tables. */
  hideLabel?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("adm-field", className)}>
      <label htmlFor={id} className={cn("adm-label", hideLabel && "sr-only")}>
        {label}
      </label>
      <select id={id} className="adm-select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <p className="adm-hint">{hint}</p> : null}
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  required,
  placeholder,
  hint,
  testId,
  lang,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  testId?: string;
  lang?: string;
}) {
  const id = useId();
  return (
    <div className="adm-field">
      <label htmlFor={id} className="adm-label">
        {label}
        {required ? (
          <span className="is-required" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      <textarea id={id} className="adm-textarea" rows={rows} value={value} lang={lang} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
      {hint ? <p className="adm-hint">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ label, checked, onChange, testId, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; testId?: string; hint?: string }) {
  return (
    <label className="adm-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      <span className="adm-switch-track" aria-hidden />
      <span>
        {label}
        {hint ? <span className="adm-hint" style={{ display: "block" }}>{hint}</span> : null}
      </span>
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
  hint,
}: {
  label: string;
  value: Localized;
  onChange: (value: Localized) => void;
  multiline?: boolean;
  required?: boolean;
  error?: string;
  testId?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <fieldset className="adm-fieldset">
      <legend>
        {label}
        {required ? (
          <span className="is-required" aria-hidden style={{ color: "var(--adm-danger)", marginLeft: 4 }}>
            *
          </span>
        ) : null}
      </legend>
      <div className={cn("grid gap-3", multiline ? "" : "md:grid-cols-3")}>
        {LOCALES.map((l) => (
          <div className="adm-field" key={l}>
            <label htmlFor={`${id}-${l}`} className="adm-lang-tag">
              {LOCALE_LABEL[l]} ({l})
              {l === REQUIRED_LOCALE ? <span className="is-required" style={{ color: "var(--adm-danger)" }} aria-hidden>
                {" *"}
              </span> : null}
            </label>
            {multiline ? (
              <textarea
                id={`${id}-${l}`}
                className="adm-textarea"
                rows={4}
                value={value[l]}
                onChange={(e) => onChange({ ...value, [l]: e.target.value })}
                lang={l}
                data-testid={testId ? `${testId}-${l}` : undefined}
              />
            ) : (
              <input
                id={`${id}-${l}`}
                type="text"
                className="adm-input"
                value={value[l]}
                onChange={(e) => onChange({ ...value, [l]: e.target.value })}
                lang={l}
                data-testid={testId ? `${testId}-${l}` : undefined}
              />
            )}
          </div>
        ))}
      </div>
      {hint ? <p className="adm-hint" style={{ marginTop: 8 }}>{hint}</p> : null}
      {error ? (
        <p className="adm-err" style={{ marginTop: 8 }}>
          <TriangleAlert aria-hidden />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export const emptyLocalized = (): Localized => ({ hy: "", ru: "", en: "" });

/* ------------------------------------------------------------- image editor */

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
    <div className="adm-field">
      <span className="adm-label">{label}</span>
      {images.length ? (
        <ul className="adm-tiles">
          {images.map((img, i) => (
            <li className="adm-tile" key={`${img.url}-${i}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary allowed sources */}
              <img src={img.url} alt={img.alt.en || img.alt.hy || ""} />
              <input
                type="text"
                className="adm-input"
                aria-label={`Alt text (hy) for image ${i + 1}`}
                placeholder="Alt text (hy)"
                value={img.alt.hy}
                onChange={(e) => onChange(images.map((x, j) => (j === i ? { ...x, alt: { ...x.alt, hy: e.target.value, en: x.alt.en || e.target.value } } : x)))}
              />
              <div className="adm-tile-row">
                <button
                  type="button"
                  className="adm-linkbtn is-muted"
                  disabled={i === 0}
                  onClick={() => onChange(images.map((x, j) => (j === i - 1 ? images[i]! : j === i ? images[i - 1]! : x)))}
                >
                  Move up
                </button>
                <button type="button" className="adm-iconbtn" style={{ marginLeft: "auto" }} onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label={`Remove image ${i + 1}`}>
                  <Trash2 aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-hint">No images yet.</p>
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
          <label htmlFor={`${label}-file`} className={cn("adm-btn", uploading && "is-busy")} style={{ cursor: "pointer" }} aria-busy={uploading}>
            {uploading ? null : <Upload aria-hidden />}
            {uploading ? "Uploading…" : "Upload image"}
          </label>
          <div className="adm-field" style={{ flex: "1 1 220px" }}>
            <label htmlFor={`${label}-url`} className="adm-hint">
              Or add by URL (/media, Cloudinary or Pexels)
            </label>
            <input id={`${label}-url`} type="text" className="adm-input is-mono" placeholder="https://res.cloudinary.com/…/p-01.png" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="adm-field" style={{ width: 84 }}>
            <label htmlFor={`${label}-w`} className="adm-hint">
              Width
            </label>
            <input id={`${label}-w`} type="number" className="adm-input is-num" value={dims.width} onChange={(e) => setDims({ ...dims, width: e.target.value })} />
          </div>
          <div className="adm-field" style={{ width: 84 }}>
            <label htmlFor={`${label}-h`} className="adm-hint">
              Height
            </label>
            <input id={`${label}-h`} type="number" className="adm-input is-num" value={dims.height} onChange={(e) => setDims({ ...dims, height: e.target.value })} />
          </div>
          <Button onClick={addUrl} disabled={!url.trim() || !Number(dims.width) || !Number(dims.height)}>
            <ImagePlus aria-hidden /> Add URL
          </Button>
        </div>
      ) : null}
      <p className="adm-hint">JPEG, PNG, WebP or AVIF up to 5 MB. Dimensions are used to reserve layout space on the storefront.</p>
    </div>
  );
}

/* -------------------------------------------------------------------- save bar */

export function SaveBar({
  pending,
  onCancel,
  label = "Save",
  testId,
  dirty,
  hint,
}: {
  pending: boolean;
  onCancel?: () => void;
  label?: string;
  testId?: string;
  dirty?: boolean;
  hint?: ReactNode;
}) {
  return (
    <div className="adm-savebar">
      <span className={cn("adm-savebar-state", dirty && "is-dirty")} role="status" aria-live="polite">
        {dirty ? "Unsaved changes" : hint ?? "All changes saved"}
      </span>
      <span className="adm-savebar-actions">
        {onCancel ? (
          <Button variant="quiet" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending} data-testid={testId}>
          {pending ? "Saving…" : label}
        </Button>
      </span>
    </div>
  );
}
