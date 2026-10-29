/**
 * Next.js instrumentation hook. Validates configuration at boot (fail fast in production)
 * and starts the in-process background job loop on the Node.js runtime.
 * Serverless deployments should disable JOBS_IN_PROCESS and call POST /api/v1/cron/run instead.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { config } = await import("./server/config");
  const cfg = config(); // throws ConfigError (variable names only, never values)
  if (cfg.jobsInProcess && cfg.mongoUri) {
    const { startJobLoop } = await import("./server/jobs");
    startJobLoop();
  }
}
