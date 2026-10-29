import type { Page } from "@playwright/test";
import { addFirstQuickAdd, confirmAge, expect, gotoReady, test } from "./fixtures";

async function gridNames(page: Page): Promise<string[]> {
  return page.getByTestId("product-grid").getByTestId("product-card").locator("h2").allInnerTexts();
}

test.beforeAll(async ({ request }) => {
  const res = await request.post("/api/v1/test-support/seed", { headers: { "X-Test-Token": process.env.E2E_TEST_API_TOKEN ?? "e2e-local-token" } });
  expect(res.ok()).toBeTruthy();
});

test.describe("catalog", () => {
  test("lists products with count, sorting and URL persistence (back/forward)", async ({ agePage: page }) => {
    await gotoReady(page, "/en/shop");
    await expect(page.getByTestId("results-count")).toContainText(/Showing 1–12 of 13 results/);
    await page.getByTestId("sort-select").selectOption("price-asc");
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect.poll(async () => (await gridNames(page))[0]).toBe("Double Apple");
    await page.getByTestId("sort-select").selectOption("price-desc");
    await expect.poll(async () => (await gridNames(page))[0]).toBe("Vaporize");
    await page.goBack();
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect.poll(async () => (await gridNames(page))[0]).toBe("Double Apple");
    await page.goForward();
    await expect(page).toHaveURL(/sort=price-desc/);
  });

  test("paginates with real links", async ({ agePage: page }) => {
    await gotoReady(page, "/en/shop");
    const pagination = page.getByTestId("pagination");
    await pagination.getByRole("link", { name: "Page 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("results-count")).toContainText("Showing 13–13 of 13 results");
    await expect(page.getByTestId("product-grid").getByTestId("product-card")).toHaveCount(1);
  });

  test("sidebar filters combine (category + nicotine + stock + price) and clear", async ({ agePage: page }) => {
    await gotoReady(page, "/en/shop/sidebar");
    const panel = page.locator("aside").getByTestId("filters-panel");
    await panel.getByTestId("filter-category-e-juices").click();
    await expect(page).toHaveURL(/category=e-juices/);
    await expect(page.getByTestId("results-count")).toContainText("of 4 results");
    await panel.getByTestId("filter-nicotine-12").click();
    await expect(page).toHaveURL(/nicotine=12/);
    await expect.poll(() => gridNames(page)).toEqual(expect.arrayContaining(["Dual Aroma", "Pair Vapor"]));
    await panel.getByTestId("filter-in-stock").click();
    await expect(page).toHaveURL(/inStock=true/);
    await panel.getByTestId("price-max").fill("5500");
    await expect(page).toHaveURL(/maxPrice=5500/, { timeout: 10_000 });
    await expect.poll(() => gridNames(page)).toEqual(["Dual Aroma"]);
    await expect(page.getByTestId("active-filters")).toBeVisible();
    await page.getByTestId("clear-filters").click();
    await expect(page).toHaveURL(/\/en\/shop\/sidebar$/);
    await expect(page.getByTestId("results-count")).toContainText("of 13 results");
  });

  test("brand filter via drawer on Shop Grid and empty state", async ({ agePage: page }) => {
    await gotoReady(page, "/en/shop");
    await page.getByTestId("open-filters").click();
    const drawer = page.getByTestId("filters-drawer");
    await expect(drawer).toBeVisible();
    await drawer.getByTestId("filter-brand-uwell").click();
    await expect(page).toHaveURL(/brand=uwell/);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await gotoReady(page, "/en/shop?q=zzzz-no-match");
    await expect(page.getByTestId("empty-state")).toContainText("No products match your filters");
  });

  test("malformed query parameters never crash the page", async ({ agePage: page }) => {
    const res = await page.goto("/en/shop?sort=%27%3B--&page=-9&category[$ne]=x&minPrice=abc&nicotine=999");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("product-grid")).toBeVisible();
  });

  test("shows a skeleton while loading and an error with working retry", async ({ agePage: page }) => {
    await gotoReady(page, "/en/shop");
    let fail = true;
    await page.route("**/api/v1/products?*", async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      if (fail) await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL", message: "x" } }) });
      else await route.continue();
    });
    await page.getByTestId("sort-select").selectOption("popularity");
    await expect(page.getByTestId("product-skeleton").first()).toBeVisible();
    await expect(page.getByTestId("error-state")).toBeVisible({ timeout: 20_000 });
    fail = false;
    await page.getByTestId("error-state").getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("error-state")).toHaveCount(0);
    await expect(page.getByTestId("product-grid")).toBeVisible();
  });

  test("instant search: debounced suggestions, keyboard selection and full results page", async ({ agePage: page }) => {
    await gotoReady(page, "/en");
    await page.getByTestId("open-search").click();
    const overlay = page.getByTestId("search-overlay");
    await expect(overlay).toBeVisible();
    const input = overlay.getByRole("combobox");
    await input.fill("a");
    await expect(page.getByTestId("search-status")).toHaveText("Type at least 2 characters.");
    await input.fill("aero");
    await expect(overlay.getByRole("option")).toHaveCount(2);
    await input.press("ArrowDown");
    await expect(overlay.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/en\/products\/(aero-core|aeropulse)$/);
    await page.getByTestId("open-search").click();
    await page.getByTestId("search-overlay").getByRole("combobox").fill("apple");
    await page.getByTestId("search-overlay").getByRole("combobox").press("Enter");
    await expect(page).toHaveURL(/\/en\/search\?q=apple/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("apple");
    await page.getByTestId("open-search").click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("search-overlay")).toHaveCount(0);
  });
});

test.describe("product detail", () => {
  test("variant switching updates price, SKU, stock and disables sold-out variants", async ({ agePage: page }) => {
    await gotoReady(page, "/en/products/double-apple");
    await expect(page.getByRole("heading", { level: 1, name: "Double Apple" })).toBeVisible();
    await expect(page.getByTestId("product-sku")).toHaveText("DA-30-3");
    await expect(page.getByTestId("product-price")).toContainText("4 900 ֏");
    const options = page.getByTestId("variant-options");
    const soldOut = options.getByRole("radio", { name: /12 mg.*sold out/ });
    await expect(soldOut).toBeDisabled();
    await options.getByRole("radio", { name: /0 mg/ }).click();
    await expect(page.getByTestId("product-sku")).toHaveText("DA-60-0");
    await expect(page.getByTestId("product-price")).toContainText("7 900 ֏");
    await expect(page).toHaveURL(/variant=/);
    await expect(page.getByTestId("product-warnings")).toBeVisible();
  });

  test("shows a real sale only with both prices", async ({ agePage: page }) => {
    await gotoReady(page, "/en/products/vape-edge");
    const price = page.getByTestId("product-price");
    await expect(price).toContainText("19 900 ֏");
    await expect(price.locator("del")).toContainText("24 900 ֏");
    await page.getByTestId("variant-options").getByRole("radio", { name: "Purple" }).click();
    await expect(price.locator("del")).toHaveCount(0);
  });

  test("quantity is capped by stock and add-to-cart shows loading then success once", async ({ agePage: page }) => {
    await gotoReady(page, "/en/products/vaporize-mini");
    await page.getByTestId("variant-options").getByRole("radio", { name: /Watermelon/ }).click();
    await expect(page.getByTestId("stock-status")).toContainText("Only 3 left");
    const increase = page.getByRole("button", { name: "Increase quantity" });
    await increase.click();
    await increase.click();
    await expect(increase).toBeDisabled();
    let posts = 0;
    await page.route("**/api/v1/cart/items*", async (route) => {
      posts += 1;
      await new Promise((r) => setTimeout(r, 500));
      await route.continue();
    });
    const add = page.getByTestId("add-to-cart");
    await add.click();
    await add.click({ force: true }).catch(() => undefined);
    await expect(add).toHaveAttribute("data-state", "loading");
    await expect(add).toHaveAttribute("data-state", "success");
    expect(posts).toBe(1);
    await expect(page.getByTestId("cart-drawer")).toBeVisible();
    await expect(page.getByTestId("cart-drawer-line")).toContainText("Watermelon");
  });

  test("backend failure on add keeps the user informed", async ({ agePage: page }) => {
    await gotoReady(page, "/en/products/aero-core");
    await page.route("**/api/v1/cart/items*", (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"error":{"code":"INTERNAL","message":"x"}}' }));
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("toast").filter({ hasText: "Could not add to cart" })).toBeVisible();
    await expect(page.getByTestId("add-to-cart")).not.toHaveAttribute("data-state", "success");
  });

  test("gallery thumbnails and zoom dialog work; related products navigate", async ({ agePage: page }) => {
    await gotoReady(page, "/en/products/vape-edge");
    const thumbs = page.getByTestId("gallery-thumb");
    if ((await thumbs.count()) > 1) {
      await thumbs.nth(1).click();
      await expect(thumbs.nth(1)).toHaveAttribute("aria-pressed", "true");
    }
    await page.getByTestId("gallery-zoom").click();
    await expect(page.getByRole("dialog", { name: "Product image" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Product image" })).toHaveCount(0);
    const related = page.getByTestId("related-products").getByTestId("product-card").first();
    const slug = await related.getAttribute("data-slug");
    await related.locator("h3 a").click();
    await expect(page).toHaveURL(new RegExp(`/en/products/${slug}$`));
  });

  test("out-of-stock product cannot be added", async ({ agePage: page }) => {
    await gotoReady(page, "/en/products/novafume");
    await expect(page.getByTestId("add-to-cart")).toBeDisabled();
    await expect(page.getByTestId("stock-status")).toContainText("Out of stock");
  });
});

test.describe("cart", () => {
  test("add from card, update quantity, remove, persists across reloads", async ({ agePage: page, support }) => {
    await support.seed();
    await confirmAge(page);
    await gotoReady(page, "/en/shop?q=aero-core");
    await addFirstQuickAdd(page);
    await expect(page.getByTestId("cart-drawer")).toBeVisible();
    await expect(page.getByTestId("open-cart")).toHaveAttribute("aria-label", /1 item/);
    await gotoReady(page, "/en/cart");
    const table = page.getByTestId("cart-table");
    await expect(table.getByTestId("cart-line")).toHaveCount(1);
    await table.getByRole("button", { name: "Increase quantity" }).click();
    await expect(table.getByTestId("line-total")).toHaveText("29 000 ֏");
    await expect(page.getByTestId("summary-subtotal")).toHaveText("29 000 ֏");
    await page.reload();
    await expect(page.getByTestId("cart-table").getByTestId("line-total")).toHaveText("29 000 ֏");
    await page.getByTestId("cart-table").getByRole("button", { name: /Remove Aero Core/ }).click();
    await expect(page.getByTestId("empty-state")).toContainText("Your cart is empty");
  });

  test("reflects stock reductions and price changes from the server", async ({ agePage: page, support }) => {
    await support.seed();
    await confirmAge(page);
    await gotoReady(page, "/en/products/vaporize-mini");
    await page.getByTestId("variant-options").getByRole("radio", { name: /Mango/ }).click();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("add-to-cart")).toHaveAttribute("data-state", "success");
    await support.stock("VM-MANGO-20", 1);
    await gotoReady(page, "/en/cart");
    await expect(page.getByTestId("cart-table").getByTestId("line-status")).toHaveAttribute("data-status", "insufficient_stock");
    await expect(page.getByRole("button", { name: "Proceed To Checkout" })).toBeDisabled();
    await support.stock("VM-MANGO-20", 0);
    await page.reload();
    await expect(page.getByTestId("cart-table").getByTestId("line-status")).toHaveAttribute("data-status", "out_of_stock");
  });

  test("a failing cart request shows an error with retry, never a fake empty cart", async ({ agePage: page }) => {
    await page.route("**/api/v1/cart?*", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":{"code":"SERVICE_UNAVAILABLE","message":"x"}}' }));
    await page.goto("/en/cart");
    await expect(page.getByTestId("error-state")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("empty-state")).toHaveCount(0);
    await expect(page.getByTestId("open-cart")).toHaveAttribute("aria-label", "Cart (count unavailable)");
  });

  test("coupon and region change server-computed totals", async ({ agePage: page, support }) => {
    await support.seed();
    await confirmAge(page);
    await gotoReady(page, "/en/shop?q=aero-core");
    await addFirstQuickAdd(page);
    await gotoReady(page, "/en/cart");
    await expect(page.getByTestId("summary-shipping")).toHaveText("1 000 ֏");
    await page.getByTestId("cart-region").selectOption("lori");
    await expect(page.getByTestId("summary-shipping")).toHaveText("2 000 ֏");
    await expect(page.getByTestId("summary-total")).toHaveText("16 500 ֏");
    await expect(page.getByTestId("summary-vat")).toHaveText("2 750 ֏");
    await page.getByTestId("coupon-input").fill("WELCOME10");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByTestId("coupon-status")).toContainText("Coupon WELCOME10 applied");
    await expect(page.getByTestId("summary-discount")).toHaveText("−1 450 ֏");
    await page.getByTestId("coupon-input").fill("EXPIRED5");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByTestId("coupon-status")).toContainText("expired");
  });
});
