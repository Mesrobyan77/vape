import { NextResponse, type NextRequest } from "next/server";
import type { HydratedDocument } from "mongoose";
import { z } from "zod";
import { config } from "../config";
import { connectDb } from "../db";
import { AppError, toAppError } from "../errors";
import { logger } from "../logger";
import { User, type SessionDoc, type UserDoc } from "../models";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  clearedSessionCookies,
  createSession,
  findValidSession,
  isPlausibleToken,
  issueCsrfToken,
  revokeSession,
  sessionCookies,
  verifyCsrfToken,
  type CookieWrite,
  type NewSessionInput,
  type SessionDocument,
} from "../auth/session";
import { enforceRateLimit, type RateLimitRule } from "./rate-limit";
import { randomToken } from "../crypto";
import type { MfaState } from "@/lib/api/types";

export const MAX_JSON_BYTES = 100 * 1024;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type AuthLevel = "optional" | "user" | "admin";

export interface Ctx<P, B, Q> {
  req: NextRequest;
  params: P;
  body: B;
  query: Q;
  requestId: string;
  ip: string;
  session: SessionDocument | null;
  user: HydratedDocument<UserDoc> | null;
  /** Ensures a (possibly anonymous) session exists and returns it. */
  ensureSession(): Promise<SessionDocument>;
  /** Ensures a session and issues a fresh CSRF token (cookie + returned value). */
  issueCsrf(): Promise<string>;
  /** Replaces the current session (fixation defence) and returns the new CSRF token. */
  rotateSession(next: NewSessionInput): Promise<{ session: SessionDocument; csrfToken: string }>;
  /** Revokes the current session and clears cookies. */
  endSession(): Promise<void>;
  setCookie(cookie: CookieWrite): void;
  headers: Headers;
}

export interface HandlerOptions<B extends z.ZodType | undefined, Q extends z.ZodType | undefined> {
  auth?: AuthLevel;
  /** CSRF + Origin checks for mutating methods (default true). Provider callbacks set false. */
  csrf?: boolean;
  body?: B;
  query?: Q;
  rateLimit?: { rule: RateLimitRule; key?: "ip" | ((ctx: { ip: string; rawBody: unknown }) => string) }[];
  cache?: "no-store" | "public";
  maxBodyBytes?: number;
  /** Require 18+ confirmation on the session. */
  requireAge?: boolean;
  /** Skip the JSON body parsing (multipart / form / raw handlers read the request themselves). */
  rawBody?: boolean;
}

export type HandlerResult =
  | { data?: unknown; meta?: unknown; status?: number; headers?: Record<string, string> }
  | Response;

type Infer<T> = T extends z.ZodType ? z.output<T> : undefined;

export function clientIp(req: NextRequest): string {
  if (config().trustProxyHeaders) {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64);
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim().slice(0, 64);
  }
  return "0.0.0.0";
}

function requestOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (origin && origin !== "null") return origin.replace(/\/$/, "");
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

export function zodDetails(error: z.ZodError) {
  return error.issues.slice(0, 50).map((i) => ({ path: i.path.join("."), message: i.message }));
}

async function readJson(req: NextRequest, limit: number): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > limit) throw new AppError("PAYLOAD_TOO_LARGE");
  const text = await req.text();
  if (Buffer.byteLength(text) > limit) throw new AppError("PAYLOAD_TOO_LARGE");
  if (text.trim() === "") return undefined;
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new AppError("BAD_REQUEST", "Expected application/json.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("BAD_REQUEST", "Malformed JSON.");
  }
}

export function queryObject(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    // repeated params are joined (csv semantics); keys are bounded
    if (key.length > 40) return;
    out[key] = key in out ? `${out[key]},${value}` : value;
  });
  return out;
}

export function errorResponse(err: unknown, requestId: string): NextResponse {
  const appErr = toAppError(err);
  if (appErr.status >= 500) logger.error({ requestId, err, code: appErr.code }, "request failed");
  const headers: Record<string, string> = { "X-Request-Id": requestId, "Cache-Control": "no-store" };
  if (appErr.code === "RATE_LIMITED" && appErr.details && !Array.isArray(appErr.details)) {
    headers["Retry-After"] = String(appErr.details.retryAfter ?? 60);
  }
  const details = appErr.code === "RATE_LIMITED" ? undefined : appErr.details;
  return NextResponse.json(
    { error: { code: appErr.code, message: appErr.message, ...(details ? { details } : {}), requestId } },
    { status: appErr.status, headers },
  );
}

export function mfaStateOf(session: Pick<SessionDoc, "role" | "mfaVerified"> | null, user: Pick<UserDoc, "role" | "mfa"> | null): MfaState {
  if (!session || !user || user.role !== "admin") return "none";
  if (session.mfaVerified) return "none";
  return user.mfa.enabled ? "verify" : "enroll";
}

/**
 * Wraps a Route Handler with request id, body/query validation, session loading,
 * CSRF + Origin checks, rate limiting, authorization and safe error mapping.
 */
export function handler<
  P extends Record<string, string | string[]> = Record<string, never>,
  B extends z.ZodType | undefined = undefined,
  Q extends z.ZodType | undefined = undefined,
>(options: HandlerOptions<B, Q>, fn: (ctx: Ctx<P, Infer<B>, Infer<Q>>) => Promise<HandlerResult>) {
  return async (req: NextRequest, segment: { params: Promise<P> }): Promise<Response> => {
    const requestId = req.headers.get("x-request-id")?.slice(0, 64).replace(/[^\w-]/g, "") || randomToken(9);
    const cookieWrites: CookieWrite[] = [];
    const responseHeaders = new Headers();
    try {
      const method = req.method.toUpperCase();
      const mutating = MUTATING.has(method);
      const cfg = config();
      const ip = clientIp(req);

      if (mutating && options.csrf !== false) {
        const origin = requestOrigin(req);
        if (!origin || !cfg.allowedOrigins.includes(origin)) throw new AppError("ORIGIN_NOT_ALLOWED");
      }

      // Body / query validation
      let rawBody: unknown = undefined;
      if (!options.rawBody && mutating) rawBody = await readJson(req, options.maxBodyBytes ?? MAX_JSON_BYTES);
      let body: unknown = undefined;
      if (options.body) {
        const parsed = options.body.safeParse(rawBody ?? {});
        if (!parsed.success) throw new AppError("VALIDATION_FAILED", undefined, zodDetails(parsed.error));
        body = parsed.data;
      }
      let query: unknown = undefined;
      if (options.query) {
        const parsed = options.query.safeParse(queryObject(req));
        if (!parsed.success) throw new AppError("VALIDATION_FAILED", undefined, zodDetails(parsed.error));
        query = parsed.data;
      }

      for (const limit of options.rateLimit ?? []) {
        const key = typeof limit.key === "function" ? limit.key({ ip, rawBody }) : ip;
        await enforceRateLimit(limit.rule, key);
      }

      // Session
      let session: SessionDocument | null = null;
      const rawToken = req.cookies.get(SESSION_COOKIE)?.value;
      if (isPlausibleToken(rawToken)) {
        await connectDb();
        session = await findValidSession(rawToken);
      }

      if (mutating && options.csrf !== false) {
        const header = req.headers.get("x-csrf-token") ?? "";
        const cookie = req.cookies.get(CSRF_COOKIE)?.value ?? "";
        if (!session || !header || header !== cookie || !verifyCsrfToken(session.tokenHash, header)) {
          throw new AppError("CSRF_INVALID");
        }
      }

      let user: HydratedDocument<UserDoc> | null = null;
      if (session?.userId) {
        user = await User.findById(session.userId);
        if (!user || !user.active) {
          await revokeSession(session._id);
          session = null;
          user = null;
          cookieWrites.push(...clearedSessionCookies());
        }
      }

      const auth = options.auth ?? "optional";
      if (auth === "user" || auth === "admin") {
        if (!user || !session) throw new AppError("UNAUTHENTICATED");
      }
      if (auth === "admin") {
        if (user!.role !== "admin") throw new AppError("FORBIDDEN");
        const mfa = mfaStateOf(session, user);
        if (mfa !== "none") throw new AppError("MFA_REQUIRED", undefined, { mfa });
      }
      if (options.requireAge && !session?.ageConfirmedAt) throw new AppError("AGE_CONFIRMATION_REQUIRED");

      const ctx: Ctx<P, Infer<B>, Infer<Q>> = {
        req,
        params: await segment.params,
        body: body as Infer<B>,
        query: query as Infer<Q>,
        requestId,
        ip,
        session,
        user,
        headers: responseHeaders,
        setCookie: (c) => cookieWrites.push(c),
        async ensureSession() {
          if (ctx.session) return ctx.session;
          const { token, session: created } = await createSession({ userAgent: req.headers.get("user-agent") ?? "" });
          cookieWrites.push(...sessionCookies(token, created).cookies);
          ctx.session = created;
          return created;
        },
        async issueCsrf() {
          const session = await ctx.ensureSession();
          const token = issueCsrfToken(session.tokenHash);
          const maxAge = (session.absoluteExpiresAt.getTime() - Date.now()) / 1000;
          const base = sessionCookies("x".repeat(43), session).cookies.find((c) => c.name === CSRF_COOKIE)!;
          cookieWrites.push({ ...base, value: token, options: { ...base.options, maxAge: Math.max(0, Math.floor(maxAge)) } });
          return token;
        },
        async rotateSession(next) {
          const previous = ctx.session;
          if (previous) await revokeSession(previous._id);
          const { token, session: created } = await createSession({
            ageConfirmedAt: previous?.ageConfirmedAt ?? null,
            userAgent: req.headers.get("user-agent") ?? "",
            ...next,
          });
          const { cookies, csrfToken } = sessionCookies(token, created);
          cookieWrites.push(...cookies);
          ctx.session = created;
          return { session: created, csrfToken };
        },
        async endSession() {
          if (ctx.session) await revokeSession(ctx.session._id);
          ctx.session = null;
          ctx.user = null;
          cookieWrites.push(...clearedSessionCookies());
        },
      };

      const result = await fn(ctx);
      let response: Response;
      if (result instanceof Response) {
        response = result;
      } else {
        const status = result.status ?? 200;
        const payload = status === 204 ? null : { data: result.data ?? null, ...(result.meta !== undefined ? { meta: result.meta } : {}) };
        response = payload === null ? new NextResponse(null, { status }) : NextResponse.json(payload, { status });
        for (const [k, v] of Object.entries(result.headers ?? {})) response.headers.set(k, v);
      }
      responseHeaders.forEach((v, k) => response.headers.set(k, v));
      response.headers.set("X-Request-Id", requestId);
      if (!response.headers.has("Cache-Control")) {
        response.headers.set(
          "Cache-Control",
          options.cache === "public" && !cookieWrites.length ? "public, max-age=30, stale-while-revalidate=120" : "no-store",
        );
      }
      applyCookies(response, cookieWrites);
      return response;
    } catch (err) {
      const response = errorResponse(err, requestId);
      applyCookies(response, cookieWrites);
      return response;
    }
  };
}

function applyCookies(response: Response, writes: CookieWrite[]): void {
  if (!writes.length) return;
  if (response instanceof NextResponse) {
    for (const c of writes) response.cookies.set(c.name, c.value, c.options);
    return;
  }
  for (const c of writes) {
    const parts = [`${c.name}=${encodeURIComponent(c.value)}`, `Path=${c.options.path}`, `Max-Age=${c.options.maxAge}`, "SameSite=Lax"];
    if (c.options.httpOnly) parts.push("HttpOnly");
    if (c.options.secure) parts.push("Secure");
    if (c.options.domain) parts.push(`Domain=${c.options.domain}`);
    response.headers.append("Set-Cookie", parts.join("; "));
  }
}

/** Helpers for common schema pieces. */
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
export const idParam = z.object({ id: objectId });

export function parseParams<T extends z.ZodType>(schema: T, params: unknown): z.output<T> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw new AppError("NOT_FOUND");
  return parsed.data;
}
