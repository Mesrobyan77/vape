/**
 * npm run seed:dev — loads the deterministic development catalogue into MONGODB_URI.
 * WIPES the target database first. Refuses to run when NODE_ENV=production.
 */
import { config } from "../src/server/config";
import { disconnectDb } from "../src/server/db";
import { seedDatabase } from "../src/server/seed";

async function main(): Promise<void> {
  const cfg = config();
  if (cfg.isProduction) throw new Error("Refusing to seed in production.");
  if (!cfg.mongoUri) throw new Error("MONGODB_URI is not set (or use `npm run dev:memory`).");
  const counts = await seedDatabase({ reset: true });
  console.log(`Seeded database "${cfg.mongoDbName}":`, counts);
  await disconnectDb();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
