/**
 * npm run jobs:run — one pass of background jobs (reservation expiry, outbox delivery,
 * orphan media cleanup). Safe to run concurrently with the in-process loop or cron.
 * Pass --loop to keep running every 15 s (a standalone worker process).
 */
import { disconnectDb } from "../src/server/db";
import { runJobsOnce } from "../src/server/jobs";

async function once(): Promise<void> {
  const result = await runJobsOnce();
  console.log(JSON.stringify({ time: new Date().toISOString(), ...result }));
}

async function main(): Promise<void> {
  if (!process.argv.includes("--loop")) {
    await once();
    await disconnectDb();
    return;
  }
  let stopping = false;
  process.on("SIGINT", () => (stopping = true));
  process.on("SIGTERM", () => (stopping = true));
  while (!stopping) {
    await once().catch((err: unknown) => console.error("jobs failed:", err instanceof Error ? err.message : err));
    await new Promise((r) => setTimeout(r, 15_000));
  }
  await disconnectDb();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
