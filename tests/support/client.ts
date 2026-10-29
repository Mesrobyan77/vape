import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";

export const SITE = "http://localhost:3000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- route handlers have heterogeneous param types
type RouteFn = (req: NextRequest, ctx: { params: Promise<any> }) => Promise<Response>;

export interface CallOptions {
  body?: unknown;
  rawBody?: string | FormData;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  /** Attach the CSRF header from the cookie jar (default true for mutations). */
  csrf?: boolean;
  origin?: string | null;
}

export interface ApiResult<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
  text: string;
}

/**
 * Minimal browser-like client for calling Route Handlers in-process: keeps a cookie jar,
 * sends Origin + CSRF headers and a stable fake client IP.
 */
export class TestClient {
  readonly cookies = new Map<string, string>();
  readonly ip: string;

  constructor(ip?: string) {
    this.ip = ip ?? `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;
  }

  cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async call<T = unknown>(route: RouteFn, method: string, path: string, opts: CallOptions = {}): Promise<ApiResult<T>> {
    const headers: Record<string, string> = { "x-forwarded-for": this.ip, "user-agent": "vitest", ...(opts.headers ?? {}) };
    const cookie = this.cookieHeader();
    if (cookie) headers.cookie = cookie;
    const mutating = !["GET", "HEAD"].includes(method);
    if (mutating && opts.origin !== null) headers.origin = opts.origin ?? SITE;
    if (mutating && opts.csrf !== false && this.cookies.get("vh_csrf")) headers["x-csrf-token"] = this.cookies.get("vh_csrf")!;
    let body: BodyInit | undefined;
    if (opts.rawBody !== undefined) body = opts.rawBody;
    else if (opts.body !== undefined) {
      body = JSON.stringify(opts.body);
      headers["content-type"] = "application/json";
    }
    const req = new NextRequest(new URL(path, SITE), { method, headers, body });
    const res = await route(req, { params: Promise.resolve(opts.params ?? {}) });
    for (const sc of res.headers.getSetCookie()) {
      const [pair, ...attrs] = sc.split(";");
      const idx = pair!.indexOf("=");
      const name = pair!.slice(0, idx).trim();
      const value = decodeURIComponent(pair!.slice(idx + 1).trim());
      const expired = attrs.some((a) => /max-age=0/i.test(a.trim())) || value === "";
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await res.text();
    let parsed: unknown = undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = text;
    }
    return { status: res.status, body: parsed as T, headers: res.headers, text };
  }
}
