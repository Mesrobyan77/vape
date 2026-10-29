import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/server/errors";

describe("outbox", () => {
  beforeEach(async () => {
    const { resetDatabase, ensureIndexes } = await import("@/server/seed");
    await resetDatabase();
    await ensureIndexes();
  });

  it("enqueues exactly once per dedupe key", async () => {
    const { enqueue } = await import("@/server/services/outbox");
    const { Outbox } = await import("@/server/models");
    await enqueue([{ type: "email", dedupeKey: "k1", payload: {} }]);
    await enqueue([{ type: "email", dedupeKey: "k1", payload: {} }]);
    expect(await Outbox.countDocuments({ dedupeKey: "k1" })).toBe(1);
  });

  it("retries with backoff and dead-letters after max attempts", async () => {
    const { enqueue, processOutbox, backoffMs } = await import("@/server/services/outbox");
    const { Outbox } = await import("@/server/models");
    await enqueue([{ type: "flaky", dedupeKey: "f1", payload: {}, maxAttempts: 3 }]);
    let calls = 0;
    const handlers = {
      flaky: async () => {
        calls += 1;
        throw new Error("smtp down");
      },
    };
    for (let i = 0; i < 3; i += 1) {
      await processOutbox(handlers);
      await Outbox.updateOne({ dedupeKey: "f1" }, { $set: { nextAttemptAt: new Date(0) } });
    }
    const doc = await Outbox.findOne({ dedupeKey: "f1" }).lean();
    expect(calls).toBe(3);
    expect(doc).toMatchObject({ status: "dead", attempts: 3, lastError: "smtp down" });
    await processOutbox(handlers);
    expect(calls).toBe(3); // dead letters are not retried
    expect(backoffMs(1)).toBeLessThan(backoffMs(3));
  });

  it("delivers successfully after a transient failure", async () => {
    const { enqueue, processOutbox } = await import("@/server/services/outbox");
    const { Outbox } = await import("@/server/models");
    await enqueue([{ type: "sometimes", dedupeKey: "s1", payload: {} }]);
    let n = 0;
    const handlers = {
      sometimes: async () => {
        n += 1;
        if (n === 1) throw new Error("timeout");
      },
    };
    await processOutbox(handlers);
    await Outbox.updateOne({ dedupeKey: "s1" }, { $set: { nextAttemptAt: new Date(0) } });
    await processOutbox(handlers);
    expect((await Outbox.findOne({ dedupeKey: "s1" }).lean())!.status).toBe("sent");
  });

  it("concurrent workers never deliver the same event twice", async () => {
    const { enqueue, processOutbox } = await import("@/server/services/outbox");
    await enqueue(Array.from({ length: 20 }, (_, i) => ({ type: "count", dedupeKey: `c${i}`, payload: { i } })));
    const seen: number[] = [];
    const handlers = {
      count: async (e: { payload: Record<string, unknown> }) => {
        seen.push(e.payload.i as number);
      },
    };
    await Promise.all([processOutbox(handlers), processOutbox(handlers), processOutbox(handlers)]);
    expect(seen.sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
});

describe("upload validation", () => {
  it("accepts real images by magic bytes and rejects spoofed files", async () => {
    const { validateImage } = await import("@/server/services/media");
    const png = readFileSync(path.resolve(__dirname, "../fixtures/logo.png"));
    await expect(validateImage(png)).resolves.toMatchObject({ mime: "image/png", width: 229, height: 48 });
    const spoof = Buffer.concat([Buffer.from("<?php echo 'x'; ?>"), Buffer.alloc(100)]);
    await expect(validateImage(spoof)).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(validateImage(svg)).rejects.toBeInstanceOf(AppError);
    await expect(validateImage(Buffer.alloc(0))).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(validateImage(Buffer.alloc(6 * 1024 * 1024))).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    // truncated PNG header → cannot decode
    await expect(validateImage(png.subarray(0, 40))).rejects.toBeInstanceOf(AppError);
  });
});
