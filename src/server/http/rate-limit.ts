import { config } from "../config";
import { sha256 } from "../crypto";
import { connectDb } from "../db";
import { AppError } from "../errors";
import { RateLimitHit } from "../models";

export interface RateLimitRule {
  name: string;
  windowMs: number;
  limit: number;
}

const MIN = 60_000;

export const LIMITS = {
  loginAccount: { name: "login-acct", windowMs: 15 * MIN, limit: 8 },
  loginIp: { name: "login-ip", windowMs: 15 * MIN, limit: 40 },
  register: { name: "register", windowMs: 60 * MIN, limit: 10 },
  forgotPassword: { name: "forgot", windowMs: 60 * MIN, limit: 5 },
  resetPassword: { name: "reset", windowMs: 60 * MIN, limit: 10 },
  mfa: { name: "mfa", windowMs: 15 * MIN, limit: 10 },
  search: { name: "search", windowMs: MIN, limit: 120 },
  contact: { name: "contact", windowMs: 60 * MIN, limit: 5 },
  newsletter: { name: "newsletter", windowMs: 60 * MIN, limit: 10 },
  cartWrite: { name: "cart", windowMs: MIN, limit: 60 },
  checkout: { name: "checkout", windowMs: 10 * MIN, limit: 15 },
  paymentInitiate: { name: "pay-init", windowMs: 10 * MIN, limit: 20 },
  paymentStatus: { name: "pay-status", windowMs: MIN, limit: 90 },
  callbacks: { name: "callbacks", windowMs: MIN, limit: 300 },
  uploads: { name: "uploads", windowMs: 10 * MIN, limit: 30 },
  pexels: { name: "pexels", windowMs: MIN, limit: 20 },
  account: { name: "account", windowMs: MIN, limit: 60 },
  admin: { name: "admin", windowMs: MIN, limit: 300 },
} satisfies Record<string, RateLimitRule>;

interface Bucket {
  hits: number;
  resetAt: number;
}

const globalForRl = globalThis as unknown as { __vhRateLimit?: Map<string, Bucket> };
const memory: Map<string, Bucket> = (globalForRl.__vhRateLimit ??= new Map());

function memoryHit(id: string, windowMs: number): Bucket {
  const now = Date.now();
  let bucket = memory.get(id);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { hits: 0, resetAt: now + windowMs };
    memory.set(id, bucket);
    if (memory.size > 50_000) {
      for (const [k, b] of memory) if (b.resetAt <= now) memory.delete(k);
    }
  }
  bucket.hits += 1;
  return bucket;
}

async function mongoHit(id: string, windowMs: number): Promise<Bucket> {
  await connectDb();
  const now = new Date();
  // Reset an expired window atomically, then increment (shared across instances).
  await RateLimitHit.updateOne({ _id: id, resetAt: { $lte: now } }, { $set: { hits: 0, resetAt: new Date(now.getTime() + windowMs) } });
  const doc = await RateLimitHit.findOneAndUpdate(
    { _id: id },
    { $inc: { hits: 1 }, $setOnInsert: { resetAt: new Date(now.getTime() + windowMs) } },
    { upsert: true, new: true },
  );
  return { hits: doc?.hits ?? 1, resetAt: (doc?.resetAt ?? now).getTime() };
}

/** Counts a hit for `key` under `rule`; throws RATE_LIMITED (with retryAfter seconds) when exceeded. */
export async function enforceRateLimit(rule: RateLimitRule, key: string): Promise<void> {
  const cfg = config();
  if (cfg.rateLimitDisabled) return;
  const id = `${rule.name}:${sha256(key)}`;
  const bucket = cfg.rateLimitStore === "mongo" ? await mongoHit(id, rule.windowMs) : memoryHit(id, rule.windowMs);
  if (bucket.hits > rule.limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
    throw new AppError("RATE_LIMITED", undefined, { retryAfter });
  }
}

export function resetMemoryRateLimits(): void {
  memory.clear();
}
