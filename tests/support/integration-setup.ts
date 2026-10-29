import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, inject } from "vitest";

// Configure the environment BEFORE any server module reads it.
process.env.MONGODB_URI = inject("mongoUri");
process.env.MONGODB_DB_NAME = `vh_test_${randomBytes(6).toString("hex")}`;
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.PAYMENT_MODE = "mock";
process.env.MOCK_PAYMENT_SECRET = "test-mock-secret";
process.env.JOBS_IN_PROCESS = "false";
process.env.LOG_LEVEL = "silent";
process.env.RATE_LIMIT_STORE = "memory";
process.env.E2E_TEST_API_TOKEN = "test-token";

const { setConfig } = await import("@/server/config");
setConfig(null);
const { resetMemoryRateLimits } = await import("@/server/http/rate-limit");

beforeEach(() => {
  resetMemoryRateLimits();
});

afterAll(async () => {
  const mongoose = (await import("mongoose")).default;
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase().catch(() => undefined);
  }
  const { disconnectDb } = await import("@/server/db");
  await disconnectDb();
});
