import { beforeAll, describe, expect, it } from "vitest";
import type { Facets, ProductCard, ProductDetail } from "@/lib/api/types";
import { GET as productsRoute } from "@/app/api/v1/products/route";
import { GET as facetsRoute } from "@/app/api/v1/products/facets/route";
import { GET as suggestRoute } from "@/app/api/v1/products/suggest/route";
import { GET as productRoute } from "@/app/api/v1/products/[slug]/route";
import { GET as categoriesRoute } from "@/app/api/v1/categories/route";
import { GET as settingsRoute } from "@/app/api/v1/settings/public/route";
import { GET as blogRoute } from "@/app/api/v1/blog/route";
import { GET as blogPostRoute } from "@/app/api/v1/blog/[slug]/route";
import { TestClient, seed } from "../support/fixtures";

type List = { data: ProductCard[]; meta: { total: number; totalPages: number; page: number } };

describe("catalog API", () => {
  const c = new TestClient();
  beforeAll(async () => {
    await seed();
  });

  it("lists active products with pagination meta", async () => {
    const res = await c.call<List>(productsRoute, "GET", "/api/v1/products?pageSize=5&locale=en");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.meta.total).toBe(13);
    expect(res.body.meta.totalPages).toBe(3);
    expect(res.headers.get("cache-control")).toContain("public");
  });

  it("sorts by price ascending and descending", async () => {
    const asc = await c.call<List>(productsRoute, "GET", "/api/v1/products?sort=price-asc&pageSize=48");
    const prices = asc.body.data.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const desc = await c.call<List>(productsRoute, "GET", "/api/v1/products?sort=price-desc&pageSize=1");
    expect(desc.body.data[0]!.slug).toBe("vaporize");
  });

  it("applies in-stock together with nicotine strength to the same variant (regression)", async () => {
    // double-apple has a 12 mg variant that is sold out, plus other in-stock variants.
    const res = await c.call<List>(productsRoute, "GET", "/api/v1/products?category=e-juices&nicotine=12&inStock=true&pageSize=48");
    expect(res.body.data.map((p) => p.slug).sort()).toEqual(["dual-aroma", "pair-vapor"]);
    const withoutStock = await c.call<List>(productsRoute, "GET", "/api/v1/products?category=e-juices&nicotine=12&pageSize=48");
    expect(withoutStock.body.data.map((p) => p.slug)).toContain("double-apple");
  });

  it("filters by category, brand, flavor, nicotine, price and stock", async () => {
    const cat = await c.call<List>(productsRoute, "GET", "/api/v1/products?category=e-juices&pageSize=48");
    expect(cat.body.data.map((p) => p.slug).sort()).toEqual(["double-apple", "dual-aroma", "pair-vapor", "twin-fruit"]);
    const brand = await c.call<List>(productsRoute, "GET", "/api/v1/products?brand=vopo&category=e-juices");
    expect(brand.body.data.map((p) => p.slug).sort()).toEqual(["dual-aroma", "pair-vapor"]);
    const flavor = await c.call<List>(productsRoute, "GET", "/api/v1/products?flavor=mango-ice");
    expect(flavor.body.data.map((p) => p.slug)).toEqual(["vaporize-mini"]);
    const nic = await c.call<List>(productsRoute, "GET", "/api/v1/products?nicotine=20&pageSize=48");
    expect(nic.body.data.map((p) => p.slug).sort()).toEqual(["pair-vapor", "vaporize-mini"]);
    const price = await c.call<List>(productsRoute, "GET", "/api/v1/products?minPrice=40000&maxPrice=50000");
    expect(price.body.data.map((p) => p.slug)).toEqual(["vaporize"]);
    const all = await c.call<List>(productsRoute, "GET", "/api/v1/products?pageSize=48");
    const stocked = await c.call<List>(productsRoute, "GET", "/api/v1/products?inStock=true&pageSize=48");
    expect(stocked.body.data.find((p) => p.slug === "novafume")).toBeUndefined();
    expect(all.body.data.find((p) => p.slug === "novafume")?.inStock).toBe(false);
  });

  it("searches by name in any locale", async () => {
    const res = await c.call<List>(productsRoute, "GET", "/api/v1/products?q=apple");
    expect(res.body.data.map((p) => p.slug)).toEqual(["double-apple"]);
    const none = await c.call<List>(productsRoute, "GET", "/api/v1/products?q=zzzz-nothing");
    expect(none.body.data).toEqual([]);
    expect(none.body.meta.total).toBe(0);
  });

  it("treats regex metacharacters and operator payloads as plain text", async () => {
    const res = await c.call<List>(productsRoute, "GET", `/api/v1/products?q=${encodeURIComponent(".*")}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    const inj = await c.call(productsRoute, "GET", `/api/v1/products?category[$ne]=x`);
    expect([200, 422]).toContain(inj.status);
  });

  it("rejects malformed query parameters with 422", async () => {
    for (const qs of ["sort=evil", "pageSize=1000", "page=0", "minPrice=-5", "minPrice=500&maxPrice=100", "nicotine=abc"]) {
      const res = await c.call<{ error: { code: string } }>(productsRoute, "GET", `/api/v1/products?${qs}`);
      expect(res.status, qs).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("marks real sales only and exposes a default variant for single-variant products", async () => {
    const res = await c.call<List>(productsRoute, "GET", "/api/v1/products?pageSize=48");
    const edge = res.body.data.find((p) => p.slug === "vape-edge")!;
    expect(edge.price).toBe(19900);
    expect(edge.compareAtPrice).toBe(24900);
    const ignition = res.body.data.find((p) => p.slug === "ignition")!;
    expect(ignition.compareAtPrice).toBeNull();
    expect(ignition.defaultVariantId).toBeNull();
    expect(res.body.data.find((p) => p.slug === "aero-core")!.defaultVariantId).toMatch(/^[a-f0-9]{24}$/);
  });

  it("returns facets with disjunctive counts", async () => {
    const res = await c.call<{ data: Facets }>(facetsRoute, "GET", "/api/v1/products/facets?category=e-juices&locale=en");
    expect(res.status).toBe(200);
    const f = res.body.data;
    expect(f.categories.find((x) => x.slug === "e-juices")?.count).toBe(4);
    expect(f.categories.find((x) => x.slug === "pod-systems")?.count).toBe(2);
    expect(f.brands.map((b) => b.slug).sort()).toEqual(["voodoo", "vopo"]);
    expect(f.nicotine.map((n) => n.value)).toEqual([0, 3, 6, 12, 20]);
    expect(f.price.min).toBe(4900);
  });

  it("returns product detail with localized fields, variants and related products", async () => {
    const hy = await c.call<{ data: ProductDetail }>(productRoute, "GET", "/api/v1/products/double-apple?locale=hy", { params: { slug: "double-apple" } });
    expect(hy.status).toBe(200);
    expect(hy.body.data.variants).toHaveLength(4);
    expect(hy.body.data.variants.find((v) => v.sku === "DA-60-12")?.available).toBe(0);
    expect(hy.body.data.warnings[0]).toContain("նիկոտին");
    expect(hy.body.data.related.length).toBeGreaterThan(0);
    const ru = await c.call<{ data: ProductDetail }>(productRoute, "GET", "/api/v1/products/double-apple?locale=ru", { params: { slug: "double-apple" } });
    expect(ru.body.data.warnings[0]).toContain("никотин");
  });

  it("404s for unknown, archived or malformed slugs", async () => {
    const { Product } = await import("@/server/models");
    await Product.updateOne({ slug: "twin-fruit" }, { $set: { status: "archived" } });
    for (const slug of ["nope", "twin-fruit", "../etc/passwd", "%24where"]) {
      const res = await c.call(productRoute, "GET", `/api/v1/products/${encodeURIComponent(slug)}`, { params: { slug } });
      expect(res.status, slug).toBe(404);
    }
    await Product.updateOne({ slug: "twin-fruit" }, { $set: { status: "active" } });
  });

  it("suggests products and validates the query length", async () => {
    const res = await c.call<{ data: { slug: string }[] }>(suggestRoute, "GET", "/api/v1/products/suggest?q=vap");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.length).toBeLessThanOrEqual(6);
    expect((await c.call(suggestRoute, "GET", "/api/v1/products/suggest?q=a")).status).toBe(422);
  });

  it("lists categories with counts, public settings and blog", async () => {
    const cats = await c.call<{ data: { slug: string; productCount: number }[] }>(categoriesRoute, "GET", "/api/v1/categories?locale=en");
    expect(cats.body.data.find((x) => x.slug === "e-juices")?.productCount).toBe(4);
    const settings = await c.call<{ data: { shipping: { freeThreshold: number }; regions: unknown[]; paymentMethods: { method: string; enabled: boolean }[] } }>(
      settingsRoute,
      "GET",
      "/api/v1/settings/public?locale=hy",
    );
    expect(settings.body.data.shipping.freeThreshold).toBe(20000);
    expect(settings.body.data.regions).toHaveLength(11);
    expect(settings.body.data.paymentMethods.find((m) => m.method === "cod")?.enabled).toBe(true);
    expect(settings.body.data.paymentMethods.find((m) => m.method === "idram")?.enabled).toBe(false);
    const blog = await c.call<{ data: { slug: string }[] }>(blogRoute, "GET", "/api/v1/blog?locale=ru");
    expect(blog.body.data).toHaveLength(6);
    const post = await c.call<{ data: { body: string } }>(blogPostRoute, "GET", "/api/v1/blog/vape-hub-opens-in-yerevan?locale=ru", { params: { slug: "vape-hub-opens-in-yerevan" } });
    expect(post.body.data.body).toContain("НДС");
  });
});
