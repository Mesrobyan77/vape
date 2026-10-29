import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";

export const TOKEN = process.env.E2E_TEST_API_TOKEN ?? "e2e-local-token";
export const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? 3100}`;

/** Test-support API (non-production only, X-Test-Token protected). */
export class Support {
  constructor(private readonly request: APIRequestContext) {}
  private async post<T>(action: string, data?: unknown): Promise<T> {
    const res = await this.request.post(`/api/v1/test-support/${action}`, { headers: { "X-Test-Token": TOKEN }, data: data ?? {} });
    expect(res.ok(), `${action}: ${res.status()} ${await res.text()}`).toBeTruthy();
    return ((await res.json()) as { data: T }).data;
  }
  seed = () => this.post("seed");
  stock = (sku: string, stock: number) => this.post("stock", { sku, stock });
  expireReservations = (orderNumber?: string) => this.post("expire-reservations", orderNumber ? { orderNumber } : {});
  runJobs = () => this.post("run-jobs");
  admin = (email: string, password: string) => this.post<{ email: string; totpSecret: string }>("admin", { email, password });
  totp = (secret: string) => this.post<{ code: string }>("totp", { secret });
  async emails(to: string) {
    const res = await this.request.get(`/api/v1/test-support/emails?to=${encodeURIComponent(to)}`, { headers: { "X-Test-Token": TOKEN } });
    return ((await res.json()) as { data: { subject: string; text: string; template: string }[] }).data;
  }
  async order(number: string) {
    const res = await this.request.get(`/api/v1/test-support/order?number=${encodeURIComponent(number)}`, { headers: { "X-Test-Token": TOKEN } });
    return ((await res.json()) as { data: { status: string; paymentStatus: string } }).data;
  }
}

/**
 * Confirms 18+ for this browser context the way the UI does: server-side session flag
 * (via the real endpoint, with CSRF + Origin) plus the UX cookie.
 */
export async function confirmAge(page: Page) {
  const origin = ORIGIN;
  const csrf = await page.request.get("/api/v1/auth/csrf");
  const token = ((await csrf.json()) as { data: { csrfToken: string } }).data.csrfToken;
  const res = await page.request.post("/api/v1/compliance/age-confirmation", {
    headers: { "X-CSRF-Token": token, Origin: origin },
    data: { confirmed: true },
  });
  expect(res.status()).toBe(204);
  await page.context().addCookies([{ name: "vh_age", value: "1", url: origin }]);
}

/** Waits until the first-visit preloader has gone so clicks are not intercepted. */
export async function ready(page: Page) {
  await expect(page.getByTestId("preloader")).toHaveCount(0, { timeout: 15_000 });
}

export async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await ready(page);
}

export async function addFirstQuickAdd(page: Page) {
  const card = page.getByTestId("product-card").filter({ has: page.getByTestId("quick-add") }).first();
  await card.hover();
  await card.getByTestId("quick-add").click();
}

export const test = base.extend<{ support: Support; agePage: Page }>({
  support: async ({ request }, use) => {
    await use(new Support(request));
  },
  /** A page whose session already confirmed age (most storefront tests). */
  agePage: async ({ page }, use) => {
    await page.goto("/api/health");
    await confirmAge(page);
    await use(page);
  },
});

export { expect };
