import type { ClientSession } from "mongoose";
import { isDuplicateKeyError } from "../errors";
import { logger } from "../logger";
import { Outbox, type OutboxDoc } from "../models";

export interface OutboxEvent {
  type: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}

/**
 * Enqueues side effects. Inside a transaction the event commits atomically with the
 * business change; the unique dedupeKey makes repeated triggers (duplicate callbacks,
 * retries) collapse into a single delivery.
 */
export async function enqueue(events: OutboxEvent[], session?: ClientSession): Promise<void> {
  if (events.length === 0) return;
  if (session) {
    // A duplicate-key error would abort the transaction, so filter known keys first
    // (the unique index still guarantees exactly-once).
    const existing = await Outbox.find({ dedupeKey: { $in: events.map((e) => e.dedupeKey) } }, { dedupeKey: 1 }).session(session);
    const known = new Set(existing.map((e) => e.dedupeKey));
    const fresh = events.filter((e) => !known.has(e.dedupeKey));
    if (fresh.length) await Outbox.insertMany(fresh.map(toDoc), { session });
    return;
  }
  for (const event of events) {
    try {
      await Outbox.create(toDoc(event));
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }
  }
}

const toDoc = (e: OutboxEvent) => ({
  type: e.type,
  dedupeKey: e.dedupeKey,
  payload: e.payload,
  maxAttempts: e.maxAttempts ?? 6,
  status: "pending" as const,
  nextAttemptAt: new Date(),
});

export type OutboxHandler = (event: OutboxDoc) => Promise<void>;

const LEASE_MS = 60_000;

export function backoffMs(attempts: number): number {
  return Math.min(60 * 60_000, 2 ** attempts * 15_000);
}

/** Atomically claims one due event (lease-based, safe across concurrent workers). */
export async function claimNext(now = new Date()): Promise<OutboxDoc | null> {
  return Outbox.findOneAndUpdate(
    {
      $or: [
        { status: { $in: ["pending", "failed"] }, nextAttemptAt: { $lte: now } },
        { status: "processing", lockedUntil: { $lte: now } },
      ],
    },
    { $set: { status: "processing", lockedUntil: new Date(now.getTime() + LEASE_MS) }, $inc: { attempts: 1 } },
    { sort: { nextAttemptAt: 1 }, new: true },
  ).lean<OutboxDoc>();
}

export async function processOutbox(handlers: Record<string, OutboxHandler>, maxEvents = 50): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < maxEvents; i += 1) {
    const event = await claimNext();
    if (!event) break;
    const handle = handlers[event.type];
    try {
      if (!handle) throw new Error(`no handler for ${event.type}`);
      await handle(event);
      await Outbox.updateOne({ _id: event._id, status: "processing" }, { $set: { status: "sent", sentAt: new Date(), lockedUntil: null, lastError: null } });
      sent += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message.slice(0, 500) : "unknown error";
      const dead = event.attempts >= event.maxAttempts;
      await Outbox.updateOne(
        { _id: event._id, status: "processing" },
        {
          $set: {
            status: dead ? "dead" : "failed",
            lastError: message,
            lockedUntil: null,
            nextAttemptAt: new Date(Date.now() + backoffMs(event.attempts)),
          },
        },
      );
      logger.warn({ type: event.type, attempts: event.attempts, dead }, "outbox delivery failed");
    }
  }
  return { sent, failed };
}
