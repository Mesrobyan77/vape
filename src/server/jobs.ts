import type { Locale } from "@/lib/api/types";
import { deliverEmail } from "./email/send";
import type { EmailTemplate } from "./email/templates";
import { logger } from "./logger";
import type { OutboxDoc } from "./models";
import { cleanupOrphanMedia } from "./services/media";
import { expireReservations } from "./services/orders";
import { processOutbox, type OutboxHandler } from "./services/outbox";

async function revalidate(event: OutboxDoc): Promise<void> {
  const tags = Array.isArray(event.payload.tags) ? (event.payload.tags as unknown[]).filter((t): t is string => typeof t === "string") : [];
  try {
    const { revalidateTag } = await import("next/cache");
    for (const tag of tags) revalidateTag(tag, "max");
  } catch {
    // Outside a Next.js server context (CLI, tests) there is no cache to revalidate.
  }
}

export const OUTBOX_HANDLERS: Record<string, OutboxHandler> = {
  email: async (event) => {
    const p = event.payload as { to?: unknown; template?: unknown; locale?: unknown; data?: unknown };
    if (typeof p.to !== "string" || typeof p.template !== "string") throw new Error("invalid email payload");
    await deliverEmail({
      to: p.to,
      template: p.template as EmailTemplate,
      locale: (["hy", "ru", "en"].includes(String(p.locale)) ? p.locale : "hy") as Locale,
      data: (p.data ?? {}) as Parameters<typeof deliverEmail>[0]["data"],
    });
  },
  revalidate,
};

let lastCleanup = 0;

export interface JobRunResult {
  expired: number;
  sent: number;
  failed: number;
  orphansRemoved: number;
}

/** One pass of every background job. Idempotent and safe to run concurrently. */
export async function runJobsOnce(now = new Date()): Promise<JobRunResult> {
  const expired = await expireReservations(now);
  const { sent, failed } = await processOutbox(OUTBOX_HANDLERS);
  let orphansRemoved = 0;
  if (now.getTime() - lastCleanup > 60 * 60_000) {
    lastCleanup = now.getTime();
    orphansRemoved = await cleanupOrphanMedia(now).catch((err: unknown) => {
      logger.warn({ err }, "orphan cleanup failed");
      return 0;
    });
  }
  return { expired, sent, failed, orphansRemoved };
}

const globalForJobs = globalThis as unknown as { __vhJobs?: { timer: NodeJS.Timeout; running: boolean } };

/** Starts the in-process scheduler (no-op if already running). */
export function startJobLoop(intervalMs = 15_000): void {
  if (globalForJobs.__vhJobs) return;
  const state = { timer: null as unknown as NodeJS.Timeout, running: false };
  state.timer = setInterval(() => {
    if (state.running) return;
    state.running = true;
    runJobsOnce()
      .catch((err: unknown) => logger.warn({ err }, "background jobs failed"))
      .finally(() => {
        state.running = false;
      });
  }, intervalMs);
  state.timer.unref?.();
  globalForJobs.__vhJobs = state;
}

export function stopJobLoop(): void {
  if (globalForJobs.__vhJobs) clearInterval(globalForJobs.__vhJobs.timer);
  globalForJobs.__vhJobs = undefined;
}
