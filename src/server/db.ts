import mongoose, { type ClientSession } from "mongoose";
import { config } from "./config";
import { AppError } from "./errors";
import { logger } from "./logger";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null; uri: string | null };

const globalForDb = globalThis as unknown as { __vhMongo?: Cache };
const cache: Cache = (globalForDb.__vhMongo ??= { conn: null, promise: null, uri: null });

// Unknown filter paths are dropped. User input never reaches filters un-validated:
// every request body/query passes a strict zod schema that only yields primitives.
mongoose.set("strictQuery", true);

/**
 * Returns a connected mongoose instance. The connection is cached on globalThis so
 * dev hot reloads and serverless warm invocations reuse a single pool.
 */
export async function connectDb(): Promise<typeof mongoose> {
  const cfg = config();
  if (!cfg.mongoUri) throw new AppError("SERVICE_UNAVAILABLE", "Database is not configured.");
  if (cache.conn && cache.uri === cfg.mongoUri && mongoose.connection.readyState === 1) return cache.conn;
  if (!cache.promise || cache.uri !== cfg.mongoUri) {
    cache.uri = cfg.mongoUri;
    cache.promise = mongoose
      .connect(cfg.mongoUri, {
        dbName: cfg.mongoDbName,
        maxPoolSize: 10,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 30000,
        autoIndex: true,
      })
      .catch((err: unknown) => {
        cache.promise = null;
        logger.error({ err }, "mongodb connection failed");
        throw new AppError("SERVICE_UNAVAILABLE");
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
  cache.uri = null;
}

export async function pingDb(): Promise<boolean> {
  try {
    await connectDb();
    const db = mongoose.connection.db;
    if (!db) return false;
    await db.admin().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

const MAX_ATTEMPTS = 6;

function hasLabel(err: unknown, label: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as { hasErrorLabel?: (l: string) => boolean; errorLabels?: string[] | Set<string> };
  if (typeof candidate.hasErrorLabel === "function") return candidate.hasErrorLabel(label);
  const labels = candidate.errorLabels;
  if (labels instanceof Set) return labels.has(label);
  return Array.isArray(labels) && labels.includes(label);
}

export function isTransientTransactionError(err: unknown): boolean {
  if (hasLabel(err, "TransientTransactionError") || hasLabel(err, "UnknownTransactionCommitResult")) return true;
  // WriteConflict (112) surfaces as transient inside transactions.
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 112;
}

/**
 * Runs `work` inside a MongoDB transaction with bounded retries for transient
 * failures (write conflicts, primary step-downs). `work` MUST only perform
 * database operations bound to `session`: it can run more than once, so external
 * side effects (emails, provider calls) belong in the outbox.
 */
export async function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  await connectDb();
  let attempt = 0;
  for (;;) {
    attempt += 1;
    const session = await mongoose.startSession();
    try {
      session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      let result: T;
      try {
        result = await work(session);
      } catch (err) {
        if (session.inTransaction()) await session.abortTransaction().catch(() => undefined);
        throw err;
      }
      await commitWithRetry(session);
      return result;
    } catch (err) {
      if (isTransientTransactionError(err) && attempt < MAX_ATTEMPTS) {
        const backoff = Math.min(250, 10 * 2 ** attempt) + Math.floor(Math.random() * 25);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}

async function commitWithRetry(session: ClientSession): Promise<void> {
  for (let i = 0; ; i += 1) {
    try {
      await session.commitTransaction();
      return;
    } catch (err) {
      if (hasLabel(err, "UnknownTransactionCommitResult") && i < 3) continue;
      throw err;
    }
  }
}
