/**
 * Local development / E2E without MongoDB Atlas:
 *   npm run dev:memory
 * Starts a single-node in-memory replica set (transactions work), seeds the deterministic
 * catalogue, then runs `next dev` (or `next start` with DEV_MEMORY_MODE=start) with MONGODB_URI set.
 *
 * Env:
 *   PORT                 default 3000
 *   DEV_MEMORY_PERSIST=1 keep data in .data/mongo between runs (seeds only when empty)
 *   DEV_MEMORY_SEED=0    skip seeding
 *   DEV_MEMORY_MODE      dev (default) | start (serve an existing `next build`)
 *   PAYMENT_MODE, E2E_TEST_API_TOKEN, … are forwarded to Next.js unchanged.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("dev:memory must never run in production");
  const persist = process.env.DEV_MEMORY_PERSIST === "1";
  const dbPath = persist ? path.resolve(".data/mongo") : undefined;
  if (dbPath) mkdirSync(dbPath, { recursive: true });

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    instanceOpts: dbPath ? [{ dbPath }] : undefined,
  });
  await replSet.waitUntilRunning();
  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_NAME ??= "vapehub_dev";
  console.log(`[dev:memory] MongoDB replica set ready (db "${process.env.MONGODB_DB_NAME}")`);

  if (process.env.DEV_MEMORY_SEED !== "0") {
    const { seedDatabase, ensureIndexes } = await import("../src/server/seed");
    const { Product } = await import("../src/server/models");
    const { disconnectDb, connectDb } = await import("../src/server/db");
    await connectDb();
    await ensureIndexes();
    if (!persist || (await Product.estimatedDocumentCount()) === 0) {
      const counts = await seedDatabase({ reset: true });
      console.log(`[dev:memory] seeded ${counts.products} products, ${counts.categories} categories, ${counts.posts} posts`);
    }
    await disconnectDb();
  }

  const port = process.env.PORT ?? "3000";
  const mode = process.env.DEV_MEMORY_MODE === "start" ? "start" : "dev";
  process.env.NEXT_PUBLIC_SITE_URL ??= `http://localhost:${port}`;
  if (!/^\d{2,5}$/.test(port)) throw new Error("PORT must be numeric");
  // Windows needs a shell to run npx; the command is fully static apart from the validated port.
  const child =
    process.platform === "win32"
      ? spawn(`npx next ${mode} -p ${port}`, { stdio: "inherit", env: process.env, shell: true })
      : spawn("npx", ["next", mode, "-p", port], { stdio: "inherit", env: process.env });
  console.log(`[dev:memory] next ${mode} → http://localhost:${port}`);

  let stopping = false;
  const stop = async (code: number) => {
    if (stopping) return;
    stopping = true;
    if (!child.killed) child.kill();
    try {
      await replSet.stop({ doCleanup: !persist });
    } catch (err) {
      // On Windows mongod can still be releasing files; cleanup of a temp dir is best-effort.
      console.warn("[dev:memory] cleanup incomplete:", err instanceof Error ? err.message : err);
    }
    process.exit(code);
  };
  child.on("exit", (code) => void stop(code ?? 0));
  process.on("SIGINT", () => void stop(0));
  process.on("SIGTERM", () => void stop(0));
}

main().catch((err: unknown) => {
  console.error("[dev:memory] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
