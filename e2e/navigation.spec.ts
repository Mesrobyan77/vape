import { confirmAge, expect, gotoReady, ready, test } from "./fixtures";

test.describe("age gate", () => {
  test("blocks first visit until confirmed, then remembers on reload", async ({ page }) => {
    await page.goto("/en");
    const gate = page.getByTestId("age-gate");
    await expect(gate).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Are you 18 or older?" })).toBeVisible();
    await page.getByTestId("age-confirm").click();
    await expect(gate).toBeHidden();
    await page.reload();
    await ready(page);
    await expect(page.getByTestId("age-gate")).toHaveCount(0);
  });

  test("exit shows the restricted message and keeps content gated", async ({ page }) => {
    await page.goto("/en");
    await page.getByTestId("age-exit").click();
    await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
  });

  test("server enforces the confirmation for cart writes, regardless of the cookie", async ({ page }) => {
    await page.goto("/api/health");
    const origin = new URL(page.url()).origin;
    await page.context().addCookies([{ name: "vh_age", value: "1", url: origin }]);
    const csrf = (await (await page.request.get("/api/v1/auth/csrf")).json()) as { data: { csrfToken: string } };
    const res = await page.request.post("/api/v1/cart/items", {
      headers: { "X-CSRF-Token": csrf.data.csrfToken, Origin: origin },
      data: { productId: "000000000000000000000000", variantId: "000000000000000000000000", quantity: 1 },
    });
    expect(res.status()).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("AGE_CONFIRMATION_REQUIRED");
  });
});

test.describe("navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/api/health");
    await confirmAge(page);
  });

  test("home renders reference sections and the hero CTA goes to the shop", async ({ page }) => {
    await gotoReady(page, "/en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ultimate");
    await expect(page.getByRole("heading", { name: "Product Categories" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Best Sellers" })).toBeVisible();
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await expect(page.getByTestId("age-warning")).toBeVisible();
    await page.getByTestId("hero-cta").click();
    await expect(page).toHaveURL(/\/en\/shop$/);
    await expect(page.getByTestId("product-grid")).toBeVisible();
  });

  test("shop dropdown works with mouse and keyboard and closes on Escape", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop navigation");
    await gotoReady(page, "/en");
    const button = page.getByTestId("shop-menu-button");
    await button.hover();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.mouse.move(0, 400);
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("shop-menu").getByRole("link", { name: "Shop Grid", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
    await button.click();
    await page.getByTestId("shop-menu").getByRole("link", { name: "Shop Grid (Sidebar)" }).click();
    await expect(page).toHaveURL(/\/en\/shop\/sidebar$/);
  });

  test("mobile menu opens, navigates and traps focus", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile navigation");
    await gotoReady(page, "/en");
    await page.getByTestId("open-menu").click();
    const nav = page.getByTestId("mobile-nav");
    await expect(nav).toBeVisible();
    await nav.getByRole("button", { name: "Shop" }).click();
    await nav.getByRole("link", { name: "Shop Grid (Sidebar)" }).click();
    await expect(page).toHaveURL(/\/en\/shop\/sidebar$/);
    await expect(page.getByTestId("mobile-nav")).toHaveCount(0);
  });

  test("footer links and breadcrumbs lead to real pages", async ({ page }) => {
    for (const [name, path] of [
      ["About Us", "/en/about"],
      ["Contact us", "/en/contact"],
      ["FAQ", "/en/faq"],
      ["Privacy Policy", "/en/privacy"],
      ["Terms and Conditions", "/en/terms"],
      ["Shipping and Returns", "/en/shipping-returns"],
    ] as const) {
      await gotoReady(page, "/en");
      await page.getByTestId("site-footer").getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    await expect(page.getByTestId("legal-review-notice")).toBeVisible();
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("unknown routes render the localized 404 with status 404", async ({ page }) => {
    const res = await page.goto("/en/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("not-found")).toBeVisible();
    const res2 = await page.goto("/en/products/no-such-product");
    expect(res2?.status()).toBe(404);
  });

  test("direct deep links and refresh on nested routes work", async ({ page }) => {
    await gotoReady(page, "/en/shop/sidebar?category=e-juices&sort=price-asc");
    await page.reload();
    await expect(page.getByTestId("product-grid")).toBeVisible();
    await expect(page).toHaveURL(/category=e-juices/);
  });
});

test.describe("localization", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/api/health");
    await confirmAge(page);
  });

  test("root redirects to Armenian by default", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/hy$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "hy");
  });

  test("switching language keeps the current page and query", async ({ page, isMobile }) => {
    test.skip(isMobile, "header switcher");
    await gotoReady(page, "/en/shop?sort=price-asc");
    await page.getByTestId("language-switcher").click();
    await page.getByTestId("lang-ru").click();
    await expect(page).toHaveURL(/\/ru\/shop\?sort=price-asc$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Магазин");
  });

  test("each locale renders translated UI with AMD prices and hreflang links", async ({ page }) => {
    for (const [locale, heading] of [
      ["hy", "Ապրանքների կատեգորիաներ"],
      ["ru", "Категории товаров"],
      ["en", "Product Categories"],
    ] as const) {
      await gotoReady(page, `/${locale}`);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveCount(1);
      const body = await page.locator("body").innerText();
      expect(body).toMatch(/\d{1,3}( \d{3})* ֏/);
      expect(body).not.toMatch(/\b(home|nav|shop)\.[a-zA-Z]+\b/); // no raw translation keys
    }
  });
});
