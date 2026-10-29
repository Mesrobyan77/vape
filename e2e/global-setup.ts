import { request, type FullConfig } from "@playwright/test";

/** Reset + seed the isolated E2E database, then warm the dev compiler for the main routes. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3100";
  const token = process.env.E2E_TEST_API_TOKEN ?? "e2e-local-token";
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { "X-Test-Token": token } });
  const seeded = await ctx.post("/api/v1/test-support/seed");
  if (!seeded.ok()) throw new Error(`E2E seed failed: ${seeded.status()} ${await seeded.text()}`);
  for (const path of ["/en", "/en/shop", "/en/shop/sidebar", "/en/products/vape-edge", "/en/cart", "/en/checkout", "/en/account", "/admin"]) {
    await ctx.get(path, { timeout: 180_000 }).catch(() => undefined);
  }
  await ctx.dispose();
}
