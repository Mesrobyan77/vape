import type { HydratedDocument, Types } from "mongoose";
import { config } from "../config";
import { hmacSha256, randomToken, safeEqual, sha256 } from "../crypto";
import { connectDb } from "../db";
import { Session, type SessionDoc } from "../models";

export const SESSION_COOKIE = "vh_sid";
export const CSRF_COOKIE = "vh_csrf";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const SESSION_POLICY = {
  anonymous: { idleMs: 7 * DAY, absoluteMs: 30 * DAY },
  customer: { idleMs: 7 * DAY, absoluteMs: 30 * DAY },
  admin: { idleMs: 2 * HOUR, absoluteMs: 12 * HOUR },
} as const;

type SessionKind = keyof typeof SESSION_POLICY;
export type SessionDocument = HydratedDocument<SessionDoc>;

const kindOf = (role: SessionDoc["role"]): SessionKind => (role === "admin" ? "admin" : role === "customer" ? "customer" : "anonymous");

export const hashSessionToken = (token: string): string => sha256(`session:${token}`);

export interface CookieWrite {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    sameSite: "lax" | "strict";
    secure: boolean;
    path: string;
    domain?: string;
    maxAge: number;
  };
}

function cookieBase(maxAgeSeconds: number) {
  const cfg = config();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cfg.isProduction,
    path: "/",
    ...(cfg.cookieDomain ? { domain: cfg.cookieDomain } : {}),
    maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
  };
}

/** Cookies to write for a freshly issued session (opaque id + CSRF token). */
export function sessionCookies(token: string, session: SessionDoc): { cookies: CookieWrite[]; csrfToken: string } {
  const maxAge = (session.absoluteExpiresAt.getTime() - Date.now()) / 1000;
  const csrfToken = issueCsrfToken(session.tokenHash);
  return {
    csrfToken,
    cookies: [
      { name: SESSION_COOKIE, value: token, options: cookieBase(maxAge) },
      { name: CSRF_COOKIE, value: csrfToken, options: cookieBase(maxAge) },
    ],
  };
}

export function clearedSessionCookies(): CookieWrite[] {
  return [
    { name: SESSION_COOKIE, value: "", options: cookieBase(0) },
    { name: CSRF_COOKIE, value: "", options: cookieBase(0) },
  ];
}

/** Signed double-submit token: nonce.HMAC(secret, sessionHash + nonce). */
export function issueCsrfToken(sessionHash: string): string {
  const nonce = randomToken(18);
  return `${nonce}.${hmacSha256(config().sessionSecret, `${sessionHash}.${nonce}`)}`;
}

export function verifyCsrfToken(sessionHash: string, token: string): boolean {
  if (token.length > 200) return false;
  const [nonce, mac, extra] = token.split(".");
  if (!nonce || !mac || extra !== undefined || nonce.length > 64) return false;
  return safeEqual(mac, hmacSha256(config().sessionSecret, `${sessionHash}.${nonce}`));
}

export interface NewSessionInput {
  userId?: Types.ObjectId | null;
  role?: SessionDoc["role"];
  mfaVerified?: boolean;
  ageConfirmedAt?: Date | null;
  userAgent?: string;
}

export async function createSession(input: NewSessionInput): Promise<{ token: string; session: SessionDocument }> {
  await connectDb();
  const token = randomToken(32);
  const role = input.role ?? null;
  const policy = SESSION_POLICY[kindOf(role)];
  const now = Date.now();
  const idleExpiresAt = new Date(now + policy.idleMs);
  const absoluteExpiresAt = new Date(now + policy.absoluteMs);
  const session = await Session.create({
    tokenHash: hashSessionToken(token),
    userId: input.userId ?? null,
    role,
    mfaVerified: input.mfaVerified ?? false,
    ageConfirmedAt: input.ageConfirmedAt ?? null,
    idleExpiresAt,
    absoluteExpiresAt,
    expiresAt: idleExpiresAt < absoluteExpiresAt ? idleExpiresAt : absoluteExpiresAt,
    userAgent: (input.userAgent ?? "").slice(0, 200),
  });
  return { token, session };
}

export function isPlausibleToken(raw: unknown): raw is string {
  return typeof raw === "string" && raw.length >= 32 && raw.length <= 128 && /^[A-Za-z0-9_-]+$/.test(raw);
}

export async function findValidSession(token: string): Promise<SessionDocument | null> {
  await connectDb();
  const now = new Date();
  const session = await Session.findOne({ tokenHash: hashSessionToken(token), revokedAt: null });
  if (!session) return null;
  if (session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) return null;
  // Sliding idle expiry, throttled to one write per minute.
  if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
    const policy = SESSION_POLICY[kindOf(session.role)];
    const idle = new Date(now.getTime() + policy.idleMs);
    session.lastSeenAt = now;
    session.idleExpiresAt = idle;
    session.expiresAt = idle < session.absoluteExpiresAt ? idle : session.absoluteExpiresAt;
    await Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: now, idleExpiresAt: session.idleExpiresAt, expiresAt: session.expiresAt } });
  }
  return session;
}

export async function revokeSession(sessionId: Types.ObjectId): Promise<void> {
  await Session.updateOne({ _id: sessionId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllUserSessions(userId: Types.ObjectId, exceptSessionId?: Types.ObjectId): Promise<number> {
  const filter: Record<string, unknown> = { userId, revokedAt: null };
  if (exceptSessionId) filter._id = { $ne: exceptSessionId };
  const res = await Session.updateMany(filter, { $set: { revokedAt: new Date() } });
  return res.modifiedCount;
}
