/**
 * npm run seed:dev — loads the deterministic development catalogue and admin into MONGODB_URI.
 * WIPES the target database first. Requires ADMIN_EMAIL and ADMIN_PASSWORD.
 * Refuses to run when NODE_ENV=production.
 */
import { loadEnvConfig } from "@next/env";
import { config } from "../src/server/config";
import { disconnectDb } from "../src/server/db";
import { seedDatabase } from "../src/server/seed";
import { emailSchema, hashPassword, passwordProblems } from "../src/server/auth/passwords";
import { User } from "../src/server/models";
import { audit } from "../src/server/services/audit";

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const cfg = config();
  if (cfg.isProduction) throw new Error("Refusing to seed in production.");
  if (!cfg.mongoUri) throw new Error("MONGODB_URI is not set (or use `npm run dev:memory`).");

  const rawEmail = process.env.ADMIN_EMAIL;
  if (!rawEmail) throw new Error("ADMIN_EMAIL is required for the development seed.");
  const emailResult = emailSchema.safeParse(rawEmail);
  if (!emailResult.success) throw new Error("ADMIN_EMAIL must be a valid email address.");
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is required for the development seed.");
  const problems = passwordProblems(password);
  if (problems.length) throw new Error(`ADMIN_PASSWORD rejected: ${problems.join(", ")} (10–128 chars, at least two character classes).`);
  if (password.length < 14) throw new Error("ADMIN_PASSWORD must be at least 14 characters.");

  const email = emailResult.data;
  const passwordHash = await hashPassword(password);
  const counts = await seedDatabase({ reset: true });
  await User.create({ email, name: "Store Admin", passwordHash, role: "admin" });
  await audit({ actorEmail: email, action: "admin.created_via_dev_seed", targetType: "user", targetId: email });
  console.log(`Seeded database "${cfg.mongoDbName}":`, { ...counts, admin: email });
  console.log("Sign in at /admin to enrol MFA.");
  await disconnectDb();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
