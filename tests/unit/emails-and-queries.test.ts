import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/api/types";
import { renderEmail, type EmailTemplate } from "@/server/email/templates";
import { parseProductQuery, productQuerySchema } from "@/server/services/catalog";

const TEMPLATES: EmailTemplate[] = [
  "welcome",
  "account_exists",
  "password_reset",
  "order_confirmation",
  "payment_pending",
  "payment_confirmed",
  "payment_failed",
  "order_status",
  "order_shipped",
  "order_cancelled",
  "order_refunded",
  "admin_new_order",
  "contact_receipt",
];

describe("email templates", () => {
  it.each(LOCALES.flatMap((l) => TEMPLATES.map((t) => [l, t] as const)))("%s/%s renders html + text", (locale, template) => {
    const out = renderEmail(template, locale, {
      siteUrl: "https://shop.example.am",
      name: "Ani",
      orderNumber: "VH-261023-ABCDEF",
      total: 12500,
      items: [{ name: "Aero Core", quantity: 1, lineTotal: 12500 }],
      status: "shipped",
      resetUrl: "https://shop.example.am/hy/account/reset-password?token=t",
      orderUrl: "https://shop.example.am/hy/checkout/success?order=VH-261023-ABCDEF",
    });
    expect(out.subject.length).toBeGreaterThan(3);
    expect(out.html).toContain(`lang="${locale}"`);
    expect(out.text.length).toBeGreaterThan(10);
  });
  it("formats AMD and localizes copy", () => {
    const hy = renderEmail("order_confirmation", "hy", { siteUrl: "x", orderNumber: "VH-1", total: 12500 });
    const ru = renderEmail("order_confirmation", "ru", { siteUrl: "x", orderNumber: "VH-1", total: 12500 });
    expect(hy.text).toContain("12 500 ֏");
    expect(hy.subject).not.toBe(ru.subject);
    expect(ru.text).toContain("Итого");
  });
  it("escapes HTML in user-provided values", () => {
    const out = renderEmail("welcome", "en", { siteUrl: "x", name: '<script>alert("x")</script>' });
    expect(out.html).not.toContain("<script>");
    expect(out.html).toContain("&lt;script&gt;");
  });
  it("includes the reset link only in the reset email", () => {
    const out = renderEmail("password_reset", "en", { siteUrl: "x", resetUrl: "https://shop.example.am/r?token=abc" });
    expect(out.html).toContain("https://shop.example.am/r?token=abc");
  });
});

describe("catalog query parsing", () => {
  it("lenient parser drops malformed values instead of throwing", () => {
    expect(
      parseProductQuery({ page: "-3", sort: "price-asc", category: "pods,<script>,e-juices", nicotine: "3,abc,99,6", minPrice: "5000", maxPrice: "100", inStock: "yes", q: "  mango " }),
    ).toEqual({ sort: "price-asc", category: ["pods", "e-juices"], nicotine: [3, 6], q: "mango" });
  });
  it("lenient parser keeps valid ranges and flags", () => {
    expect(parseProductQuery({ page: "2", pageSize: "24", minPrice: "1000", maxPrice: "9000", inStock: "true", featured: "true" })).toEqual({
      page: 2,
      pageSize: 24,
      minPrice: 1000,
      maxPrice: 9000,
      inStock: true,
      featured: true,
    });
  });
  it("strict API schema rejects malformed values (422 path)", () => {
    expect(productQuerySchema.safeParse({ sort: "drop-table" }).success).toBe(false);
    expect(productQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
    expect(productQuerySchema.safeParse({ minPrice: "9000", maxPrice: "100" }).success).toBe(false);
    expect(productQuerySchema.safeParse({ category: "a,b", nicotine: "3,6" }).success).toBe(true);
    expect(productQuerySchema.safeParse({ nicotine: "3,$gt" }).success).toBe(false);
  });
});
