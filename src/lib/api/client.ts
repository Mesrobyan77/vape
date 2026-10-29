import type { ApiErrorBody, ApiErrorCode, ApiErrorDetail, PageMeta } from "./types";

export type ClientErrorCode = ApiErrorCode | "NETWORK" | "TIMEOUT" | "ABORTED";

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status: number,
    message: string,
    readonly details?: ApiErrorDetail[] | Record<string, unknown>,
    readonly requestId?: string,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field-level details (`VALIDATION_FAILED`). */
  get fieldErrors(): ApiErrorDetail[] {
    return Array.isArray(this.details) ? this.details : [];
  }
}

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError;

const API_PREFIX = "/api/v1";
const DEFAULT_TIMEOUT_MS = 15_000;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let csrfToken: string | null = null;
let csrfInflight: Promise<string> | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

async function fetchCsrfToken(): Promise<string> {
  if (!csrfInflight) {
    csrfInflight = (async () => {
      const res = await fetch(`${API_PREFIX}/auth/csrf`, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw await toApiError(res);
      const body = (await res.json()) as { data: { csrfToken: string } };
      csrfToken = body.data.csrfToken;
      return csrfToken;
    })().finally(() => {
      csrfInflight = null;
    });
  }
  return csrfInflight;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** multipart uploads */
  formData?: FormData;
  query?: Record<string, string | number | boolean | string[] | number[] | undefined | null>;
  signal?: AbortSignal;
  timeoutMs?: number;
  idempotencyKey?: string;
  headers?: Record<string, string>;
}

export function buildQuery(query: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = (await res.json()) as Partial<ApiErrorBody>;
  } catch {
    body = null;
  }
  const retryAfter = Number(res.headers.get("Retry-After")) || undefined;
  const err = body?.error;
  if (err?.code) return new ApiError(err.code, res.status, err.message, err.details, err.requestId, retryAfter);
  const fallback: ApiErrorCode =
    res.status === 401 ? "UNAUTHENTICATED" : res.status === 403 ? "FORBIDDEN" : res.status === 404 ? "NOT_FOUND" : res.status === 429 ? "RATE_LIMITED" : res.status >= 500 ? "INTERNAL" : "BAD_REQUEST";
  return new ApiError(fallback, res.status, res.statusText || fallback, undefined, undefined, retryAfter);
}

async function send<T>(path: string, options: RequestOptions, csrfRetry: boolean): Promise<{ data: T; meta?: PageMeta }> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (MUTATING.has(method)) {
    headers["X-CSRF-Token"] = csrfToken ?? (await fetchCsrfToken());
  }
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}${buildQuery(options.query)}`, {
      method,
      headers,
      body,
      signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (err) {
    if (options.signal?.aborted) throw new ApiError("ABORTED", 0, "Request aborted");
    if (timeout.aborted || (err instanceof DOMException && err.name === "TimeoutError")) {
      throw new ApiError("TIMEOUT", 0, "Request timed out");
    }
    throw new ApiError("NETWORK", 0, "Network request failed");
  }

  if (!res.ok) {
    const error = await toApiError(res);
    if (error.code === "CSRF_INVALID" && csrfRetry) {
      csrfToken = null;
      await fetchCsrfToken();
      return send<T>(path, options, false);
    }
    throw error;
  }
  // 202/204 (and some proxies) may send no body at all.
  const text = await res.text();
  if (!text) return { data: undefined as T };
  return JSON.parse(text) as { data: T; meta?: PageMeta };
}

/** Calls a v1 endpoint and resolves with its `data` payload. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { data } = await send<T>(path, options, true);
  return data;
}

/** Same as `api` but also returns pagination meta. */
export async function apiPage<T>(path: string, options: RequestOptions = {}): Promise<{ data: T; meta: PageMeta }> {
  const result = await send<T>(path, options, true);
  return { data: result.data, meta: result.meta ?? { page: 1, pageSize: 0, total: 0, totalPages: 0 } };
}

/** RFC 4122 v4 id for Idempotency-Key headers. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
