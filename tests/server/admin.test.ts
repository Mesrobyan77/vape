import { generateSync } from "otplib";
import { beforeEach, describe, expect, it } from "vitest";
import type { AdminDashboard, AdminOrderDetail, AdminProduct } from "@/lib/api/types";
import { GET as dashboardRoute } from "@/app/api/v1/admin/dashboard/route";
import { GET as productsRoute, POST as productCreateRoute } from "@/app/api/v1/admin/products/route";
import { PATCH as productPatchRoute, DELETE as productDeleteRoute } from "@/app/api/v1/admin/products/[id]/route";
import { POST as archiveRoute } from "@/app/api/v1/admin/products/[id]/archive/route";
import { POST as variantCreateRoute } from "@/app/api/v1/admin/products/[id]/variants/route";
import { PATCH as variantPatchRoute } from "@/app/api/v1/admin/products/[id]/variants/[variantId]/route";
import { POST as adjustRoute } from "@/app/api/v1/admin/inventory/adjust/route";
import { GET as movementsRoute } from "@/app/api/v1/admin/inventory/movements/route";
import { GET as ordersRoute } from "@/app/api/v1/admin/orders/route";
import { POST as transitionRoute } from "@/app/api/v1/admin/orders/[id]/transition/route";
import { GET as usersRoute } from "@/app/api/v1/admin/users/route";
import { PATCH as userPatchRoute } from "@/app/api/v1/admin/users/[id]/route";
import { POST as mfaResetRoute } from "@/app/api/v1/admin/users/[id]/mfa-reset/route";
import { GET as settingsRoute, PUT as settingsPutRoute } from "@/app/api/v1/admin/settings/route";
import { POST as uploadsRoute } from "@/app/api/v1/admin/uploads/route";
import { GET as auditRoute } from "@/app/api/v1/admin/audit-logs/route";
import { GET as providersRoute } from "@/app/api/v1/admin/payments/providers/route";
import { POST as couponCreateRoute } from "@/app/api/v1/admin/coupons/route";
import { POST as blogCreateRoute } from "@/app/api/v1/admin/blog/route";
import { POST as categoryCreateRoute } from "@/app/api/v1/admin/categories/route";
import { GET as pexelsRoute } from "@/app/api/v1/media/pexels/search/route";
import { GET as meRoute } from "@/app/api/v1/auth/me/route";
import { TestClient, addToCart, adminClient, placeOrder, registeredUser, seed, shopper, stockOf, variantIds } from "../support/fixtures";

const newProduct = (sku = "NEW-1") => ({
  slug: `new-product-${sku.toLowerCase()}`,
  name: { hy: "Նոր", ru: "Новый", en: "New" },
  status: "active",
  variants: [{ sku, price: 9900, stock: 5 }],
});

describe("admin API", () => {
  beforeEach(async () => {
    await seed();
  });

  it("blocks anonymous users and customers from every admin endpoint", async () => {
    const anon = new TestClient();
    const { client: customer } = await registeredUser();
    for (const [route, path] of [
      [dashboardRoute, "/api/v1/admin/dashboard"],
      [productsRoute, "/api/v1/admin/products"],
      [ordersRoute, "/api/v1/admin/orders"],
      [usersRoute, "/api/v1/admin/users"],
      [auditRoute, "/api/v1/admin/audit-logs"],
      [settingsRoute, "/api/v1/admin/settings"],
    ] as const) {
      expect((await anon.call(route, "GET", path)).status, path).toBe(401);
      expect((await customer.call(route, "GET", path)).status, path).toBe(403);
    }
    expect((await customer.call(productCreateRoute, "POST", "/api/v1/admin/products", { body: newProduct() })).status).toBe(403);
  });

  it("dashboard metrics come from persisted records", async () => {
    const { client } = await adminClient();
    const shopperClient = await shopper();
    await addToCart(shopperClient, "AC-STD", 1);
    await placeOrder(shopperClient);
    const res = await client.call<{ data: AdminDashboard }>(dashboardRoute, "GET", "/api/v1/admin/dashboard");
    expect(res.body.data.ordersTotal).toBe(1);
    expect(res.body.data.pendingOrders).toBe(1);
    expect(res.body.data.revenuePaid).toBe(0); // COD not yet collected
    expect(res.body.data.lowStock.map((l) => l.sku)).toEqual(expect.arrayContaining(["TV-ONE", "NF-STD"]));
  });

  it("product and variant CRUD with SKU uniqueness, archive and guarded delete", async () => {
    const { client } = await adminClient();
    const created = await client.call<{ data: AdminProduct }>(productCreateRoute, "POST", "/api/v1/admin/products", { body: newProduct() });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const dupSku = await client.call<{ error: { code: string } }>(productCreateRoute, "POST", "/api/v1/admin/products", { body: { ...newProduct("AC-STD"), slug: "another" } });
    expect(dupSku.status).toBe(409);
    expect((await client.call(productCreateRoute, "POST", "/api/v1/admin/products", { body: { ...newProduct("X-1"), images: [{ url: "javascript:alert(1)", width: 1, height: 1 }] } })).status).toBe(422);

    const variant = await client.call<{ data: AdminProduct }>(variantCreateRoute, "POST", `/api/v1/admin/products/${id}/variants`, { body: { sku: "NEW-2", price: 12000, stock: 1 }, params: { id } });
    expect(variant.body.data.variants).toHaveLength(2);
    expect((await client.call(variantCreateRoute, "POST", `/api/v1/admin/products/${id}/variants`, { body: { sku: "NEW-2", price: 1, stock: 1 }, params: { id } })).status).toBe(409);
    const vId = variant.body.data.variants[1]!.id;
    const priced = await client.call<{ data: AdminProduct }>(variantPatchRoute, "PATCH", `/api/v1/admin/products/${id}/variants/${vId}`, { body: { price: 11000, salePrice: 9000 }, params: { id, variantId: vId } });
    expect(priced.body.data.variants[1]).toMatchObject({ price: 11000, salePrice: 9000, stock: 1 });
    expect((await client.call(variantPatchRoute, "PATCH", `/api/v1/admin/products/${id}/variants/${vId}`, { body: { stock: 999 }, params: { id, variantId: vId } })).status).toBe(422);

    const patched = await client.call<{ data: AdminProduct }>(productPatchRoute, "PATCH", `/api/v1/admin/products/${id}`, { body: { featured: true }, params: { id } });
    expect(patched.body.data.featured).toBe(true);
    expect((await client.call(productDeleteRoute, "DELETE", `/api/v1/admin/products/${id}`, { params: { id } })).status).toBe(204);

    // products with orders cannot be deleted, only archived
    const buyer = await shopper();
    await addToCart(buyer, "AC-STD", 1);
    await placeOrder(buyer);
    const { productId } = await variantIds("AC-STD");
    expect((await client.call(productDeleteRoute, "DELETE", `/api/v1/admin/products/${productId}`, { params: { id: productId } })).status).toBe(409);
    const archived = await client.call<{ data: AdminProduct }>(archiveRoute, "POST", `/api/v1/admin/products/${productId}/archive`, { params: { id: productId } });
    expect(archived.body.data.status).toBe("archived");

    const { AuditLog } = await import("@/server/models");
    const actions = (await AuditLog.find({}).lean()).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["product.create", "variant.create", "variant.price_change", "product.update", "product.delete", "product.archive"]));
  });

  it("inventory adjustments are atomic, non-negative, recorded and audited", async () => {
    const { client } = await adminClient();
    const ids = await variantIds("IGN-BLK");
    const ok = await client.call<{ data: { stockBefore: number; stockAfter: number } }>(adjustRoute, "POST", "/api/v1/admin/inventory/adjust", { body: { ...ids, delta: -5, reason: "damaged in storage" } });
    expect(ok.body.data).toEqual({ stockBefore: 25, stockAfter: 20 });
    const negative = await client.call(adjustRoute, "POST", "/api/v1/admin/inventory/adjust", { body: { ...ids, delta: -100, reason: "oops too many" } });
    expect(negative.status).toBe(409);
    expect(await stockOf("IGN-BLK")).toBe(20);
    // concurrent adjustments all apply (no lost updates)
    await Promise.all(Array.from({ length: 5 }, () => client.call(adjustRoute, "POST", "/api/v1/admin/inventory/adjust", { body: { ...ids, delta: 2, reason: "restock batch" } })));
    expect(await stockOf("IGN-BLK")).toBe(30);
    const moves = await client.call<{ data: { delta: number; reason: string }[] }>(movementsRoute, "GET", `/api/v1/admin/inventory/movements?productId=${ids.productId}`);
    expect(moves.body.data.filter((m) => m.reason === "restock batch")).toHaveLength(5);
  });

  it("concurrent admin restock and checkout keep stock consistent", async () => {
    const { client } = await adminClient();
    const ids = await variantIds("TV-ONE");
    const buyer = await shopper();
    await addToCart(buyer, "TV-ONE", 1);
    const [order, adjust] = await Promise.all([placeOrder(buyer), client.call(adjustRoute, "POST", "/api/v1/admin/inventory/adjust", { body: { ...ids, delta: 3, reason: "new delivery" } })]);
    expect(order.status).toBe(201);
    expect(adjust.status).toBe(200);
    expect(await stockOf("TV-ONE")).toBe(3);
  });

  it("order transitions follow the state machine, require confirmation and are audited", async () => {
    const { client } = await adminClient();
    const buyer = await shopper();
    await addToCart(buyer, "AC-STD", 1);
    const number = (await placeOrder(buyer)).body.data.order.number;
    const { Order } = await import("@/server/models");
    const id = String((await Order.findOne({ number }).lean())!._id);
    const go = (to: string, extra: Record<string, unknown> = {}) =>
      client.call<{ data: AdminOrderDetail; error?: { code: string } }>(transitionRoute, "POST", `/api/v1/admin/orders/${id}/transition`, { body: { to, ...extra }, params: { id } });

    expect((await go("shipped")).status).toBe(409); // pending → shipped not allowed
    expect((await go("paid")).status).toBe(409); // never by manual label
    expect((await go("processing")).body.data.status).toBe("processing");
    expect((await go("shipped")).body.data.status).toBe("shipped");
    const delivered = await go("delivered");
    expect(delivered.body.data).toMatchObject({ status: "delivered", paymentStatus: "succeeded" }); // COD collected
    expect((await go("refunded")).status).toBe(422); // confirmation required
    expect((await go("refunded", { confirm: true })).body.data.status).toBe("refunded");
    expect((await go("refunded", { confirm: true })).status).toBe(409); // never twice
    const { AuditLog } = await import("@/server/models");
    expect(await AuditLog.countDocuments({ action: "order.transition", targetId: number })).toBe(3);
    expect(await AuditLog.countDocuments({ action: "order.refund", targetId: number })).toBe(1);
  });

  it("admin cancellation of a pending order restores stock once", async () => {
    const { client } = await adminClient();
    const buyer = await shopper();
    await addToCart(buyer, "IGN-SLV", 2);
    const number = (await placeOrder(buyer)).body.data.order.number;
    const { Order } = await import("@/server/models");
    const id = String((await Order.findOne({ number }).lean())!._id);
    expect(await stockOf("IGN-SLV")).toBe(10);
    const res = await client.call(transitionRoute, "POST", `/api/v1/admin/orders/${id}/transition`, { body: { to: "cancelled", confirm: true, note: "customer called" }, params: { id } });
    expect(res.status).toBe(200);
    expect(await stockOf("IGN-SLV")).toBe(12);
    expect((await client.call(transitionRoute, "POST", `/api/v1/admin/orders/${id}/transition`, { body: { to: "cancelled", confirm: true }, params: { id } })).status).toBe(409);
    expect(await stockOf("IGN-SLV")).toBe(12);
  });

  it("deactivating a user revokes their sessions; MFA reset requires step-up", async () => {
    const { client, secret } = await adminClient();
    const victim = await registeredUser();
    const { User } = await import("@/server/models");
    const vid = String((await User.findOne({ email: victim.email }).lean())!._id);
    expect((await client.call(userPatchRoute, "PATCH", `/api/v1/admin/users/${vid}`, { body: { active: false }, params: { id: vid } })).status).toBe(204);
    const me = await victim.client.call<{ data: { user: unknown } }>(meRoute, "GET", "/api/v1/auth/me");
    expect(me.body.data.user).toBeNull();

    const other = await adminClient();
    const otherId = String((await User.findOne({ email: other.email }).lean())!._id);
    expect((await client.call(mfaResetRoute, "POST", `/api/v1/admin/users/${otherId}/mfa-reset`, { body: { code: "000000", confirm: true }, params: { id: otherId } })).status).toBe(422);
    // The login already consumed the current step (replay protection), so step-up uses the next step (±1 tolerance).
    const fresh = await client.call(mfaResetRoute, "POST", `/api/v1/admin/users/${otherId}/mfa-reset`, { body: { code: generateSync({ secret, epoch: Math.floor(Date.now() / 1000) + 30 }), confirm: true }, params: { id: otherId } });
    expect(fresh.status).toBe(204);
    const reset = await User.findById(otherId).lean();
    expect(reset!.mfa.enabled).toBe(false);
    // the reset admin's sessions were revoked
    expect((await other.client.call(dashboardRoute, "GET", "/api/v1/admin/dashboard")).status).toBe(401);
  });

  it("settings updates are validated and change checkout pricing", async () => {
    const { client } = await adminClient();
    const current = await client.call<{ data: Record<string, unknown> }>(settingsRoute, "GET", "/api/v1/admin/settings");
    const body = { ...current.body.data, shipping: { yerevanFee: 1500, otherFee: 2500, freeThreshold: 30000 } } as Record<string, unknown>;
    delete body.banners;
    body.banners = [];
    expect((await client.call(settingsPutRoute, "PUT", "/api/v1/admin/settings", { body: { ...body, vatRatePercent: 99 } })).status).toBe(422);
    expect((await client.call(settingsPutRoute, "PUT", "/api/v1/admin/settings", { body })).status).toBe(200);
    const buyer = await shopper();
    await addToCart(buyer, "DA-30-3", 1);
    expect((await placeOrder(buyer)).body.data.order.total).toBe(4900 + 1500);
  });

  it("uploads report 503 when Cloudinary is not configured; other admin tools work", async () => {
    const { client } = await adminClient();
    const form = new FormData();
    form.append("file", new Blob([Buffer.from("not an image")], { type: "image/png" }), "x.png");
    const res = await client.call<{ error: { code: string } }>(uploadsRoute, "POST", "/api/v1/admin/uploads", { rawBody: form });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("UPLOADS_NOT_CONFIGURED");
    const providers = await client.call<{ data: { method: string; enabled: boolean }[] }>(providersRoute, "GET", "/api/v1/admin/payments/providers");
    expect(providers.body.data.find((p) => p.method === "mock")?.enabled).toBe(true);
    expect(JSON.stringify(providers.body)).not.toMatch(/test-mock-secret/);
    expect((await client.call(pexelsRoute, "GET", "/api/v1/media/pexels/search?q=smoke")).status).toBe(503);
    expect((await client.call(couponCreateRoute, "POST", "/api/v1/admin/coupons", { body: { code: "SPRING", type: "percent", value: 150 } })).status).toBe(422);
    expect((await client.call(couponCreateRoute, "POST", "/api/v1/admin/coupons", { body: { code: "SPRING", type: "percent", value: 15 } })).status).toBe(201);
    expect((await client.call(blogCreateRoute, "POST", "/api/v1/admin/blog", { body: { slug: "news-1", title: { hy: "Լուր", ru: "", en: "" }, status: "published" } })).status).toBe(201);
    expect((await client.call(categoryCreateRoute, "POST", "/api/v1/admin/categories", { body: { slug: "pods", name: { hy: "Փոդ", ru: "", en: "" } } })).status).toBe(201);
    expect((await client.call(categoryCreateRoute, "POST", "/api/v1/admin/categories", { body: { slug: "pods", name: { hy: "Փոդ", ru: "", en: "" } } })).status).toBe(409);
  });
});
