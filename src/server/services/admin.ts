import { Types, type HydratedDocument } from "mongoose";
import type { z } from "zod";
import type {
  AdminBlogPost,
  AdminBrand,
  AdminCategory,
  AdminCoupon,
  AdminDashboard,
  AdminImage,
  AdminOrderDetail,
  AdminOrderRow,
  AdminProduct,
  AdminSettings,
  AdminUserRow,
  AuditLogRow,
  ContactMessageRow,
  InventoryMovementRow,
  Localized,
  OrderStatus,
  PaymentProviderStatus,
} from "@/lib/api/types";
import { config } from "../config";
import { connectDb, withTransaction } from "../db";
import { ORDER_TRANSITIONS } from "../domain/state";
import { AppError } from "../errors";
import { emptyLocalized } from "../i18n";
import {
  AuditLog,
  BlogPost,
  Brand,
  Category,
  ContactMessage,
  Coupon,
  InventoryMovement,
  Order,
  PaymentTransaction,
  Product,
  Session,
  Settings,
  User,
  type BlogPostDoc,
  type BrandDoc,
  type CategoryDoc,
  type CouponDoc,
  type ImageRef,
  type OrderDoc,
  type ProductDoc,
  type SettingsDoc,
  type UserDoc,
  type VariantDoc,
} from "../models";
import { revokeAllUserSessions } from "../auth/session";
import { resetMfa } from "../auth/mfa";
import { paymentMethodAvailability } from "../payments/registry";
import { audit } from "./audit";
import { escapeRegex, pageMeta } from "./dto";
import { enqueue } from "./outbox";
import { orderDetail, orderSummary } from "./orders";
import { getSettings } from "./settings";
import type {
  blogInput,
  brandInput,
  categoryInput,
  couponInput,
  inventoryAdjustInput,
  productCreateInput,
  productUpdateInput,
  settingsInput,
  variantInput,
  variantUpdateInput,
} from "./admin-schemas";

export interface AdminActor {
  user: HydratedDocument<UserDoc>;
  requestId: string;
  ip: string;
}

const actorFields = (a: AdminActor) => ({ actorId: a.user._id, actorEmail: a.user.email, requestId: a.requestId, ip: a.ip });

const L = (v: Partial<Localized> | undefined | null): Localized => ({ hy: v?.hy ?? "", ru: v?.ru ?? "", en: v?.en ?? "" });

function imageOut(i: ImageRef | null | undefined): AdminImage | null {
  if (!i) return null;
  return { url: i.url, publicId: i.publicId ?? null, alt: L(i.alt), width: i.width, height: i.height };
}

const imageIn = (i: { url: string; publicId?: string | null; alt?: Partial<Localized>; width: number; height: number }): ImageRef => ({
  url: i.url,
  publicId: i.publicId ?? null,
  alt: L(i.alt),
  width: i.width,
  height: i.height,
});

async function revalidateCatalog(tags: string[] = ["catalog"]): Promise<void> {
  await enqueue([{ type: "revalidate", dedupeKey: `revalidate:${tags.join(",")}:${Date.now()}:${Math.random()}`, payload: { tags } }]);
}

/* ------------------------------------------------------------ dashboard */

function orderRow(o: OrderDoc): AdminOrderRow {
  return {
    ...orderSummary(o),
    id: String(o._id),
    customerName: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
    customerEmail: o.customer.email,
    reconciliationRequired: Boolean(o.reconciliation?.required),
  };
}

export async function dashboard(): Promise<AdminDashboard> {
  await connectDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [ordersToday, ordersTotal, revenueAgg, pendingOrders, awaitingPayment, reconciliationRequired, customers, recent, lowStockAgg] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: startOfDay } }),
    Order.countDocuments({}),
    Order.aggregate<{ total: number }>([{ $match: { paymentStatus: "succeeded" } }, { $group: { _id: null, total: { $sum: "$totals.total" } } }]),
    Order.countDocuments({ status: { $in: ["pending", "paid", "processing"] } }),
    Order.countDocuments({ status: "awaiting_payment" }),
    Order.countDocuments({ "reconciliation.required": true }),
    User.countDocuments({ role: "customer" }),
    Order.find({}).sort({ createdAt: -1 }).limit(8),
    Product.aggregate<{ productId: Types.ObjectId; name: Localized; variantId: Types.ObjectId; sku: string; stock: number }>([
      { $match: { status: "active" } },
      { $unwind: "$variants" },
      { $match: { "variants.active": true, "variants.stock": { $lte: 3 } } },
      { $project: { productId: "$_id", name: 1, variantId: "$variants._id", sku: "$variants.sku", stock: "$variants.stock" } },
      { $sort: { stock: 1 } },
      { $limit: 20 },
    ]),
  ]);
  return {
    ordersToday,
    ordersTotal,
    revenuePaid: revenueAgg[0]?.total ?? 0,
    pendingOrders,
    awaitingPayment,
    reconciliationRequired,
    customers,
    lowStock: lowStockAgg.map((r) => ({ productId: String(r.productId), productName: r.name.en || r.name.hy, variantId: String(r.variantId), sku: r.sku, stock: r.stock })),
    recentOrders: recent.map(orderRow),
  };
}

/* ------------------------------------------------------------- products */

type ProductLike = Omit<ProductDoc, "variants"> & { variants: VariantDoc[] };

export function adminProduct(p: ProductLike): AdminProduct {
  return {
    id: String(p._id),
    slug: p.slug,
    name: L(p.name),
    shortDescription: L(p.shortDescription),
    description: L(p.description),
    brandId: p.brandId ? String(p.brandId) : null,
    categoryId: p.categoryId ? String(p.categoryId) : null,
    tags: p.tags,
    images: p.images.map(imageOut).filter((i): i is AdminImage => i !== null),
    variants: p.variants.map((v) => ({
      id: String(v._id),
      sku: v.sku,
      attributes: { ...(v.attributes ?? {}) },
      label: L(v.label),
      price: v.price,
      salePrice: v.salePrice ?? null,
      stock: v.stock,
      images: v.images.map(imageOut).filter((i): i is AdminImage => i !== null),
      active: v.active,
    })),
    status: p.status,
    featured: p.featured,
    salesCount: p.salesCount,
    minPrice: p.minPrice,
    warnings: p.warnings.map(L),
    seo: { title: L(p.seo?.title), description: L(p.seo?.description) },
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listAdminProducts(q: { page: number; pageSize: number; q?: string; status?: string }) {
  await connectDb();
  const filter: Record<string, unknown> = {};
  if (q.status && ["active", "draft", "archived"].includes(q.status)) filter.status = q.status;
  if (q.q) filter.searchText = { $regex: escapeRegex(q.q.toLowerCase()), $options: "i" };
  const [docs, total] = await Promise.all([
    Product.find(filter).sort({ updatedAt: -1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean<ProductLike[]>(),
    Product.countDocuments(filter),
  ]);
  return { items: docs.map(adminProduct), meta: pageMeta(q.page, q.pageSize, total) };
}

export async function getAdminProduct(id: string): Promise<AdminProduct> {
  await connectDb();
  const p = await Product.findById(id).lean<ProductLike>();
  if (!p) throw new AppError("NOT_FOUND");
  return adminProduct(p);
}

async function assertTaxonomy(brandId?: string | null, categoryId?: string | null): Promise<void> {
  if (brandId && !(await Brand.exists({ _id: brandId }))) throw new AppError("VALIDATION_FAILED", undefined, [{ path: "brandId", message: "unknown" }]);
  if (categoryId && !(await Category.exists({ _id: categoryId }))) throw new AppError("VALIDATION_FAILED", undefined, [{ path: "categoryId", message: "unknown" }]);
}

function variantDocIn(v: z.output<typeof variantInput>) {
  return {
    sku: v.sku,
    attributes: {
      flavor: v.attributes.flavor ?? null,
      nicotineMg: v.attributes.nicotineMg ?? null,
      volumeMl: v.attributes.volumeMl ?? null,
      color: v.attributes.color ?? null,
      resistanceOhm: v.attributes.resistanceOhm ?? null,
    },
    label: L(v.label),
    price: v.price,
    salePrice: v.salePrice ?? null,
    stock: v.stock,
    images: v.images.map(imageIn),
    active: v.active,
  };
}

export async function createProduct(input: z.output<typeof productCreateInput>, actor: AdminActor): Promise<AdminProduct> {
  await connectDb();
  await assertTaxonomy(input.brandId, input.categoryId);
  const doc = await Product.create({
    slug: input.slug,
    name: L(input.name),
    shortDescription: L(input.shortDescription),
    description: L(input.description),
    brandId: input.brandId ?? null,
    categoryId: input.categoryId ?? null,
    tags: input.tags ?? [],
    images: (input.images ?? []).map(imageIn),
    status: input.status ?? "draft",
    featured: input.featured ?? false,
    warnings: (input.warnings ?? []).map(L),
    seo: { title: L(input.seo?.title), description: L(input.seo?.description) },
    variants: input.variants.map(variantDocIn),
  });
  await audit({ ...actorFields(actor), action: "product.create", targetType: "product", targetId: String(doc._id), changes: { slug: doc.slug, skus: doc.variants.map((v) => v.sku) } });
  await revalidateCatalog();
  return adminProduct(doc.toObject() as ProductLike);
}

export async function updateProduct(id: string, input: z.output<typeof productUpdateInput>, actor: AdminActor): Promise<AdminProduct> {
  await connectDb();
  const doc = await Product.findById(id);
  if (!doc) throw new AppError("NOT_FOUND");
  await assertTaxonomy(input.brandId, input.categoryId);
  const before = { slug: doc.slug, status: doc.status, featured: doc.featured };
  if (input.slug !== undefined) doc.slug = input.slug;
  if (input.name) doc.name = L(input.name);
  if (input.shortDescription) doc.shortDescription = L(input.shortDescription);
  if (input.description) doc.description = L(input.description);
  if (input.brandId !== undefined) doc.brandId = input.brandId ? new Types.ObjectId(input.brandId) : null;
  if (input.categoryId !== undefined) doc.categoryId = input.categoryId ? new Types.ObjectId(input.categoryId) : null;
  if (input.tags) doc.tags = input.tags;
  if (input.images) doc.images = input.images.map(imageIn);
  if (input.status) doc.status = input.status;
  if (input.featured !== undefined) doc.featured = input.featured;
  if (input.warnings) doc.warnings = input.warnings.map(L);
  if (input.seo) doc.seo = { title: L(input.seo.title), description: L(input.seo.description) };
  await doc.save();
  await audit({ ...actorFields(actor), action: "product.update", targetType: "product", targetId: id, changes: { before, fields: Object.keys(input) } });
  await revalidateCatalog();
  return adminProduct(doc.toObject() as ProductLike);
}

export async function archiveProduct(id: string, actor: AdminActor): Promise<AdminProduct> {
  await connectDb();
  const doc = await Product.findByIdAndUpdate(id, { $set: { status: "archived", featured: false } }, { new: true }).lean<ProductLike>();
  if (!doc) throw new AppError("NOT_FOUND");
  await audit({ ...actorFields(actor), action: "product.archive", targetType: "product", targetId: id });
  await revalidateCatalog();
  return adminProduct(doc);
}

/** Hard delete only for products that never appeared in an order (history must stay intact). */
export async function deleteProduct(id: string, actor: AdminActor): Promise<void> {
  await connectDb();
  const pid = new Types.ObjectId(id);
  if (await Order.exists({ "items.productId": pid })) throw new AppError("CONFLICT", "This product has orders — archive it instead.");
  const res = await Product.deleteOne({ _id: pid });
  if (res.deletedCount !== 1) throw new AppError("NOT_FOUND");
  await audit({ ...actorFields(actor), action: "product.delete", targetType: "product", targetId: id });
  await revalidateCatalog();
}

export async function addVariant(productId: string, input: z.output<typeof variantInput>, actor: AdminActor): Promise<AdminProduct> {
  await connectDb();
  const doc = await Product.findById(productId);
  if (!doc) throw new AppError("NOT_FOUND");
  if (doc.variants.length >= 50) throw new AppError("VALIDATION_FAILED", undefined, [{ path: "variants", message: "max 50" }]);
  doc.variants.push(variantDocIn(input));
  await doc.save();
  await audit({ ...actorFields(actor), action: "variant.create", targetType: "product", targetId: productId, changes: { sku: input.sku, price: input.price, stock: input.stock } });
  await revalidateCatalog();
  return adminProduct(doc.toObject() as ProductLike);
}

/** Variant edits never touch stock (use inventory adjustments, which are atomic and audited). */
export async function updateVariant(productId: string, variantId: string, input: z.output<typeof variantUpdateInput>, actor: AdminActor): Promise<AdminProduct> {
  await connectDb();
  const doc = await Product.findById(productId);
  const v = doc?.variants.id(variantId);
  if (!doc || !v) throw new AppError("NOT_FOUND");
  const before = { price: v.price, salePrice: v.salePrice, active: v.active };
  if (input.attributes) v.attributes = { ...v.attributes, ...input.attributes };
  if (input.label) v.label = L(input.label);
  if (input.price !== undefined) v.price = input.price;
  if (input.salePrice !== undefined) v.salePrice = input.salePrice;
  if (input.images) v.images = input.images.map(imageIn);
  if (input.active !== undefined) v.active = input.active;
  await doc.save();
  const priceChanged = before.price !== v.price || before.salePrice !== v.salePrice;
  await audit({
    ...actorFields(actor),
    action: priceChanged ? "variant.price_change" : "variant.update",
    targetType: "variant",
    targetId: `${productId}:${variantId}`,
    changes: { sku: v.sku, before, after: { price: v.price, salePrice: v.salePrice, active: v.active } },
  });
  await revalidateCatalog();
  return adminProduct(doc.toObject() as ProductLike);
}

export async function deactivateVariant(productId: string, variantId: string, actor: AdminActor): Promise<AdminProduct> {
  return updateVariant(productId, variantId, { active: false }, actor);
}

/* ------------------------------------------------------------ inventory */

export async function adjustInventory(input: z.output<typeof inventoryAdjustInput>, actor: AdminActor): Promise<{ stockBefore: number; stockAfter: number }> {
  const productId = new Types.ObjectId(input.productId);
  const variantId = new Types.ObjectId(input.variantId);
  const result = await withTransaction(async (session) => {
    const before = await Product.findOneAndUpdate(
      {
        _id: productId,
        variants: { $elemMatch: { _id: variantId, ...(input.delta < 0 ? { stock: { $gte: -input.delta } } : {}) } },
      },
      { $inc: { "variants.$.stock": input.delta } },
      { session, new: false, projection: { "variants.$": 1 } },
    ).lean<{ variants: VariantDoc[] }>();
    const v = before?.variants[0];
    if (!v) {
      const exists = await Product.exists({ _id: productId, "variants._id": variantId }).session(session);
      if (!exists) throw new AppError("NOT_FOUND");
      throw new AppError("CONFLICT", "Stock cannot become negative.", [{ path: "delta", message: "would_go_negative" }]);
    }
    const stockBefore = v.stock;
    const stockAfter = v.stock + input.delta;
    await InventoryMovement.create(
      [{ productId, variantId, sku: v.sku, delta: input.delta, stockBefore, stockAfter, reason: input.reason, kind: "admin_adjustment", actorId: actor.user._id }],
      { session },
    );
    await audit({ ...actorFields(actor), action: "inventory.adjust", targetType: "variant", targetId: v.sku, changes: { delta: input.delta, stockBefore, stockAfter, reason: input.reason } }, session);
    return { stockBefore, stockAfter };
  });
  await revalidateCatalog();
  return result;
}

export async function listMovements(q: { page: number; pageSize: number; productId?: string }) {
  await connectDb();
  const filter = q.productId ? { productId: new Types.ObjectId(q.productId) } : {};
  const [docs, total] = await Promise.all([
    InventoryMovement.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean(),
    InventoryMovement.countDocuments(filter),
  ]);
  const items: InventoryMovementRow[] = docs.map((m) => ({
    id: String(m._id),
    productId: String(m.productId),
    variantId: String(m.variantId),
    sku: m.sku,
    delta: m.delta,
    stockBefore: m.stockBefore,
    stockAfter: m.stockAfter,
    reason: m.reason,
    kind: m.kind,
    actorId: m.actorId ? String(m.actorId) : null,
    createdAt: m.createdAt.toISOString(),
  }));
  return { items, meta: pageMeta(q.page, q.pageSize, total) };
}

/* ------------------------------------------------------------ taxonomy */

const categoryOut = (c: CategoryDoc): AdminCategory => ({
  id: String(c._id),
  slug: c.slug,
  name: L(c.name),
  description: L(c.description),
  image: imageOut(c.image),
  sortOrder: c.sortOrder,
  active: c.active,
});
const brandOut = (b: BrandDoc): AdminBrand => ({ id: String(b._id), slug: b.slug, name: b.name, logo: imageOut(b.logo), sortOrder: b.sortOrder, active: b.active });

export async function listAdminCategories(): Promise<AdminCategory[]> {
  await connectDb();
  return (await Category.find({}).sort({ sortOrder: 1 }).lean<CategoryDoc[]>()).map(categoryOut);
}

export async function saveCategory(id: string | null, input: z.output<typeof categoryInput>, actor: AdminActor): Promise<AdminCategory> {
  await connectDb();
  const data = {
    slug: input.slug,
    name: L(input.name),
    description: L(input.description),
    image: input.image ? imageIn(input.image) : null,
    sortOrder: input.sortOrder ?? 0,
    active: input.active ?? true,
  };
  const doc = id ? await Category.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean<CategoryDoc>() : (await Category.create(data)).toObject();
  if (!doc) throw new AppError("NOT_FOUND");
  await audit({ ...actorFields(actor), action: id ? "category.update" : "category.create", targetType: "category", targetId: String(doc._id), changes: { slug: doc.slug } });
  await revalidateCatalog();
  return categoryOut(doc);
}

export async function deleteCategory(id: string, actor: AdminActor): Promise<void> {
  await connectDb();
  if (await Product.exists({ categoryId: new Types.ObjectId(id) })) throw new AppError("CONFLICT", "Category still has products.");
  const res = await Category.deleteOne({ _id: id });
  if (res.deletedCount !== 1) throw new AppError("NOT_FOUND");
  await audit({ ...actorFields(actor), action: "category.delete", targetType: "category", targetId: id });
  await revalidateCatalog();
}

export async function listAdminBrands(): Promise<AdminBrand[]> {
  await connectDb();
  return (await Brand.find({}).sort({ sortOrder: 1, name: 1 }).lean<BrandDoc[]>()).map(brandOut);
}

export async function saveBrand(id: string | null, input: z.output<typeof brandInput>, actor: AdminActor): Promise<AdminBrand> {
  await connectDb();
  const data = { slug: input.slug, name: input.name, logo: input.logo ? imageIn(input.logo) : null, sortOrder: input.sortOrder ?? 0, active: input.active ?? true };
  const doc = id ? await Brand.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean<BrandDoc>() : (await Brand.create(data)).toObject();
  if (!doc) throw new AppError("NOT_FOUND");
  await audit({ ...actorFields(actor), action: id ? "brand.update" : "brand.create", targetType: "brand", targetId: String(doc._id), changes: { slug: doc.slug } });
  await revalidateCatalog();
  return brandOut(doc);
}

export async function deleteBrand(id: string, actor: AdminActor): Promise<void> {
  await connectDb();
  if (await Product.exists({ brandId: new Types.ObjectId(id) })) throw new AppError("CONFLICT", "Brand still has products.");
  const res = await Brand.deleteOne({ _id: id });
  if (res.deletedCount !== 1) throw new AppError("NOT_FOUND");
  await audit({ ...actorFields(actor), action: "brand.delete", targetType: "brand", targetId: id });
  await revalidateCatalog();
}

/* -------------------------------------------------------------- orders */

export async function listAdminOrders(q: { page: number; pageSize: number; q?: string; status?: string }) {
  await connectDb();
  const filter: Record<string, unknown> = {};
  if (q.status === "reconciliation") filter["reconciliation.required"] = true;
  else if (q.status) filter.status = q.status;
  if (q.q) {
    const re = { $regex: escapeRegex(q.q), $options: "i" };
    filter.$or = [{ number: re }, { "customer.email": re }, { "customer.lastName": re }];
  }
  const [docs, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize),
    Order.countDocuments(filter),
  ]);
  return { items: docs.map(orderRow), meta: pageMeta(q.page, q.pageSize, total) };
}

export async function getAdminOrder(id: string): Promise<AdminOrderDetail> {
  await connectDb();
  const o = await Order.findById(id);
  if (!o) throw new AppError("NOT_FOUND");
  const payments = await PaymentTransaction.find({ orderId: o._id }).sort({ attempt: 1 }).lean();
  const manual = (ORDER_TRANSITIONS[o.status] as readonly OrderStatus[]).filter((s) => !["paid", "payment_failed", "awaiting_payment", "expired"].includes(s));
  return {
    ...orderDetail(o, "en"),
    id: String(o._id),
    reconciliation: { required: Boolean(o.reconciliation?.required), reason: o.reconciliation?.reason ?? null },
    payments: payments.map((p) => ({
      id: String(p._id),
      provider: p.provider,
      status: p.status,
      amount: p.amount,
      providerRef: p.providerRef ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    allowedTransitions: manual,
  };
}

/* --------------------------------------------------------------- users */

export async function listUsers(q: { page: number; pageSize: number; q?: string }) {
  await connectDb();
  const filter: Record<string, unknown> = {};
  if (q.q) filter.$or = [{ email: { $regex: escapeRegex(q.q.toLowerCase()), $options: "i" } }, { name: { $regex: escapeRegex(q.q), $options: "i" } }];
  const [docs, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean<UserDoc[]>(), User.countDocuments(filter)]);
  const counts = await Order.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { userId: { $in: docs.map((d) => d._id) } } },
    { $group: { _id: "$userId", n: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
  const items: AdminUserRow[] = docs.map((u) => ({
    id: String(u._id),
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    mfaEnabled: u.mfa.enabled,
    createdAt: u.createdAt.toISOString(),
    orderCount: countMap.get(String(u._id)) ?? 0,
  }));
  return { items, meta: pageMeta(q.page, q.pageSize, total) };
}

export async function setUserActive(id: string, active: boolean, actor: AdminActor): Promise<void> {
  await connectDb();
  if (String(actor.user._id) === id && !active) throw new AppError("CONFLICT", "You cannot deactivate your own account.");
  const res = await User.updateOne({ _id: id }, { $set: { active } });
  if (res.matchedCount !== 1) throw new AppError("NOT_FOUND");
  if (!active) await revokeAllUserSessions(new Types.ObjectId(id));
  await audit({ ...actorFields(actor), action: active ? "user.activate" : "user.deactivate", targetType: "user", targetId: id });
}

export async function adminResetMfa(id: string, actor: AdminActor): Promise<void> {
  await connectDb();
  if (String(actor.user._id) === id) throw new AppError("CONFLICT", "Use another administrator to reset your own MFA.");
  const user = await User.findById(id);
  if (!user) throw new AppError("NOT_FOUND");
  await resetMfa(user._id);
  await Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await audit({ ...actorFields(actor), action: "user.mfa_reset", targetType: "user", targetId: id });
}

/* ----------------------------------------------------------------- blog */

const blogOut = (p: BlogPostDoc): AdminBlogPost => ({
  id: String(p._id),
  slug: p.slug,
  title: L(p.title),
  excerpt: L(p.excerpt),
  body: L(p.body),
  coverImage: imageOut(p.coverImage),
  category: p.category,
  tags: p.tags,
  readMinutes: p.readMinutes,
  status: p.status,
  publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
  updatedAt: p.updatedAt.toISOString(),
});

export async function listAdminBlog(q: { page: number; pageSize: number }) {
  await connectDb();
  const [docs, total] = await Promise.all([
    BlogPost.find({}).sort({ updatedAt: -1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean<BlogPostDoc[]>(),
    BlogPost.countDocuments({}),
  ]);
  return { items: docs.map(blogOut), meta: pageMeta(q.page, q.pageSize, total) };
}

export async function saveBlogPost(id: string | null, input: z.output<typeof blogInput>, actor: AdminActor): Promise<AdminBlogPost> {
  await connectDb();
  const status = input.status ?? "draft";
  const data = {
    slug: input.slug,
    title: L(input.title),
    excerpt: L(input.excerpt),
    body: L(input.body),
    coverImage: input.coverImage ? imageIn(input.coverImage) : null,
    category: input.category ?? "news",
    tags: input.tags ?? [],
    readMinutes: input.readMinutes ?? 3,
    status,
    publishedAt: status === "published" ? (input.publishedAt ?? new Date()) : (input.publishedAt ?? null),
  };
  const doc = id ? await BlogPost.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean<BlogPostDoc>() : (await BlogPost.create(data)).toObject();
  if (!doc) throw new AppError("NOT_FOUND");
  await audit({ ...actorFields(actor), action: id ? "blog.update" : "blog.create", targetType: "blog", targetId: String(doc._id), changes: { slug: doc.slug, status } });
  await revalidateCatalog(["blog"]);
  return blogOut(doc);
}

export async function deleteBlogPost(id: string, actor: AdminActor): Promise<void> {
  await connectDb();
  const res = await BlogPost.deleteOne({ _id: id });
  if (res.deletedCount !== 1) throw new AppError("NOT_FOUND");
  await audit({ ...actorFields(actor), action: "blog.delete", targetType: "blog", targetId: id });
  await revalidateCatalog(["blog"]);
}

/* -------------------------------------------------------------- contact */

export async function listContactMessages(q: { page: number; pageSize: number; status?: string }) {
  await connectDb();
  const filter = q.status && ["new", "read", "archived"].includes(q.status) ? { status: q.status } : {};
  const [docs, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean(),
    ContactMessage.countDocuments(filter),
  ]);
  const items: ContactMessageRow[] = docs.map((m) => ({
    id: String(m._id),
    name: m.name,
    email: m.email,
    phone: m.phone,
    subject: m.subject,
    message: m.message,
    locale: m.locale,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
  }));
  return { items, meta: pageMeta(q.page, q.pageSize, total) };
}

export async function setContactStatus(id: string, status: "new" | "read" | "archived", actor: AdminActor): Promise<void> {
  await connectDb();
  const res = await ContactMessage.updateOne({ _id: id }, { $set: { status } });
  if (res.matchedCount !== 1) throw new AppError("NOT_FOUND");
  await audit({ ...actorFields(actor), action: "contact.status", targetType: "contact", targetId: id, changes: { status } });
}

/* -------------------------------------------------------------- coupons */

const couponOut = (c: CouponDoc): AdminCoupon => ({
  id: String(c._id),
  code: c.code,
  type: c.type,
  value: c.value,
  minSubtotal: c.minSubtotal,
  active: c.active,
  startsAt: c.startsAt ? c.startsAt.toISOString() : null,
  endsAt: c.endsAt ? c.endsAt.toISOString() : null,
  usageLimit: c.usageLimit ?? null,
  usedCount: c.usedCount,
});

export async function listCoupons(): Promise<AdminCoupon[]> {
  await connectDb();
  return (await Coupon.find({}).sort({ createdAt: -1 }).lean<CouponDoc[]>()).map(couponOut);
}

export async function saveCoupon(id: string | null, input: z.output<typeof couponInput>, actor: AdminActor): Promise<AdminCoupon> {
  await connectDb();
  const data = {
    code: input.code,
    type: input.type,
    value: input.value,
    minSubtotal: input.minSubtotal ?? 0,
    active: input.active ?? true,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    usageLimit: input.usageLimit ?? null,
  };
  const doc = id ? await Coupon.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean<CouponDoc>() : (await Coupon.create(data)).toObject();
  if (!doc) throw new AppError("NOT_FOUND");
  await audit({ ...actorFields(actor), action: id ? "coupon.update" : "coupon.create", targetType: "coupon", targetId: doc.code, changes: data });
  return couponOut(doc);
}

export async function deleteCoupon(id: string, actor: AdminActor): Promise<void> {
  await connectDb();
  const doc = await Coupon.findByIdAndDelete(id).lean<CouponDoc>();
  if (!doc) throw new AppError("NOT_FOUND");
  await audit({ ...actorFields(actor), action: "coupon.delete", targetType: "coupon", targetId: doc.code });
}

/* ------------------------------------------------------------- settings */

export function adminSettings(s: SettingsDoc): AdminSettings {
  return {
    vatRatePercent: s.vatRatePercent,
    shipping: { yerevanFee: s.shipping.yerevanFee, otherFee: s.shipping.otherFee, freeThreshold: s.shipping.freeThreshold },
    reservationTtlMinutes: s.reservationTtlMinutes,
    banners: s.banners.map((b) => ({
      id: String(b._id),
      title: L(b.title),
      subtitle: L(b.subtitle),
      image: imageOut(b.image),
      link: b.link,
      placement: b.placement,
      active: b.active,
      sortOrder: b.sortOrder,
    })),
    store: { phone: s.store.phone, email: s.store.email, address: L(s.store.address), hours: L(s.store.hours) },
  };
}

export async function getAdminSettings(): Promise<AdminSettings> {
  return adminSettings(await getSettings());
}

export async function updateSettings(input: z.output<typeof settingsInput>, actor: AdminActor): Promise<AdminSettings> {
  const current = await getSettings();
  const before = { vatRatePercent: current.vatRatePercent, shipping: { ...current.shipping }, reservationTtlMinutes: current.reservationTtlMinutes };
  const updated = await Settings.findOneAndUpdate(
    { key: "store" },
    {
      $set: {
        vatRatePercent: input.vatRatePercent,
        shipping: input.shipping,
        reservationTtlMinutes: input.reservationTtlMinutes,
        banners: input.banners.map((b) => ({
          title: L(b.title),
          subtitle: L(b.subtitle),
          image: b.image ? imageIn(b.image) : null,
          link: b.link,
          placement: b.placement ?? "promo",
          active: b.active ?? true,
          sortOrder: b.sortOrder ?? 0,
        })),
        store: { phone: input.store.phone, email: input.store.email, address: L(input.store.address), hours: L(input.store.hours) },
      },
    },
    { new: true, runValidators: true },
  );
  if (!updated) throw new AppError("NOT_FOUND");
  await audit({
    ...actorFields(actor),
    action: "settings.update",
    targetType: "settings",
    targetId: "store",
    changes: { before, after: { vatRatePercent: input.vatRatePercent, shipping: input.shipping, reservationTtlMinutes: input.reservationTtlMinutes }, banners: input.banners.length },
  });
  await revalidateCatalog(["settings", "catalog"]);
  return adminSettings(updated);
}

/* ---------------------------------------------------------------- audit */

export async function listAuditLogs(q: { page: number; pageSize: number; action?: string }) {
  await connectDb();
  const filter = q.action ? { action: q.action } : {};
  const [docs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const items: AuditLogRow[] = docs.map((d) => ({
    id: String(d._id),
    actorEmail: d.actorEmail,
    action: d.action,
    targetType: d.targetType,
    targetId: d.targetId,
    changes: d.changes ?? {},
    ip: d.ip,
    createdAt: d.createdAt.toISOString(),
  }));
  return { items, meta: pageMeta(q.page, q.pageSize, total) };
}

/* ------------------------------------------------------------- payments */

export function providerStatuses(): PaymentProviderStatus[] {
  const cfg = config();
  return [
    { method: "cod", enabled: true, configured: true, mode: cfg.paymentMode, note: "Cash on delivery — always available." },
    {
      method: "idram",
      enabled: paymentMethodAvailability("idram"),
      configured: cfg.idram !== null,
      mode: cfg.paymentMode,
      note: cfg.idram ? "Credentials present. Live verification required before launch." : "Not configured (IDRAM_REC_ACCOUNT / IDRAM_SECRET_KEY).",
    },
    {
      method: "arca",
      enabled: paymentMethodAvailability("arca"),
      configured: cfg.arca !== null,
      mode: cfg.paymentMode,
      note: cfg.arca ? "Credentials present. Confirm the bank's manual before enabling live mode." : "Not configured (ARCA_API_URL / ARCA_USERNAME / ARCA_PASSWORD).",
    },
    {
      method: "mock",
      enabled: paymentMethodAvailability("mock"),
      configured: !cfg.isProduction,
      mode: cfg.paymentMode,
      note: "Development/test simulator. Impossible to enable in production.",
    },
  ];
}

export const emptyL = emptyLocalized;
