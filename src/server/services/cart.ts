import { Types, type HydratedDocument } from "mongoose";
import type { Cart as CartDto, CartLine, Locale } from "@/lib/api/types";
import { computeTotals, evaluateCoupon, isRegionCode, type RegionCode } from "@/lib/pricing";
import { connectDb } from "../db";
import { AppError } from "../errors";
import { tr } from "../i18n";
import { Cart, Coupon, Product, effectivePrice, type CartDoc, type CouponDoc, type ProductDoc, type VariantDoc } from "../models";
import { imageDto } from "./dto";
import { variantLabel } from "./catalog";
import { getSettings, pricingSettingsOf } from "./settings";

export const MAX_LINE_QTY = 99;
export const MAX_CART_LINES = 50;

export type CartOwner = { userId: Types.ObjectId } | { sessionHash: string };

const ownerFilter = (owner: CartOwner) => ("userId" in owner ? { userId: owner.userId } : { sessionHash: owner.sessionHash });

export async function findCart(owner: CartOwner): Promise<HydratedDocument<CartDoc> | null> {
  await connectDb();
  return Cart.findOne(ownerFilter(owner));
}

async function getOrCreateCart(owner: CartOwner): Promise<HydratedDocument<CartDoc>> {
  await connectDb();
  const filter = ownerFilter(owner);
  const doc = await Cart.findOneAndUpdate(
    filter,
    { $setOnInsert: { ...("userId" in owner ? { userId: owner.userId, sessionHash: null } : { sessionHash: owner.sessionHash, userId: null }), items: [] } },
    { upsert: true, new: true },
  );
  return doc;
}

type LeanProduct = Omit<ProductDoc, "variants"> & { variants: VariantDoc[] };

export interface ResolvedLine {
  itemId: string;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  product: LeanProduct | null;
  variant: VariantDoc | null;
  quantity: number;
  priceAtAdd: number;
}

async function loadProducts(ids: Types.ObjectId[]): Promise<Map<string, LeanProduct>> {
  const docs = await Product.find({ _id: { $in: ids } }).lean<LeanProduct[]>();
  return new Map(docs.map((d) => [String(d._id), d]));
}

export function lineStatus(
  product: LeanProduct | null,
  variant: VariantDoc | null,
  quantity: number,
  priceAtAdd: number,
): CartLine["status"] {
  if (!product || product.status !== "active" || !variant || !variant.active) return "unavailable";
  if (variant.stock <= 0) return "out_of_stock";
  if (variant.stock < quantity) return "insufficient_stock";
  if (effectivePrice(variant) !== priceAtAdd) return "price_changed";
  return "ok";
}

export async function buildCartView(
  cart: HydratedDocument<CartDoc> | null,
  locale: Locale,
  opts: { region?: string; coupon?: string } = {},
): Promise<CartDto> {
  const settings = await getSettings();
  const pricing = pricingSettingsOf(settings);
  const items = cart?.items ?? [];
  const products = await loadProducts(items.map((i) => i.productId));
  const lines: CartLine[] = items.map((item) => {
    const product = products.get(String(item.productId)) ?? null;
    const variant = product?.variants.find((v) => String(v._id) === String(item.variantId)) ?? null;
    const status = lineStatus(product, variant, item.quantity, item.priceAtAdd);
    const unitPrice = variant ? effectivePrice(variant) : item.priceAtAdd;
    const name = product ? tr(product.name, locale) : "";
    return {
      id: String(item._id),
      productId: String(item.productId),
      variantId: String(item.variantId),
      slug: product?.slug ?? "",
      name,
      variantLabel: variant ? variantLabel(variant, locale) : "",
      sku: variant?.sku ?? "",
      image: imageDto(variant?.images[0] ?? product?.images[0], locale, name),
      unitPrice,
      compareAtPrice: variant && variant.salePrice !== null && variant.salePrice < variant.price ? variant.price : null,
      previousUnitPrice: status === "price_changed" ? item.priceAtAdd : null,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
      available: variant && product?.status === "active" && variant.active ? Math.max(0, variant.stock) : 0,
      status,
    };
  });

  const priced = lines.filter((l) => l.status === "ok" || l.status === "price_changed");
  const region: RegionCode = opts.region && isRegionCode(opts.region) ? opts.region : "yerevan";
  const subtotalLines = priced.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity }));
  let discount = 0;
  let couponView: CartDto["coupon"] = null;
  if (opts.coupon) {
    const code = opts.coupon.trim().toUpperCase().slice(0, 40);
    const coupon = /^[A-Z0-9_-]{2,40}$/.test(code) ? await Coupon.findOne({ code }).lean<CouponDoc>() : null;
    const subtotal = subtotalLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const result = evaluateCoupon(coupon, subtotal);
    if (result.ok) {
      discount = result.discount;
      couponView = { code, valid: true };
    } else {
      couponView = { code, valid: false, reason: result.reason };
    }
  }
  const totals = computeTotals(subtotalLines, region, pricing, discount);
  return {
    id: cart ? String(cart._id) : null,
    items: lines,
    totals: { ...totals, shippingEstimated: !opts.region || !isRegionCode(opts.region) },
    coupon: couponView,
    issues: lines.filter((l) => l.status !== "ok").map((l) => ({ itemId: l.id, type: l.status })),
  };
}

async function loadSellable(productId: string, variantId: string): Promise<{ product: LeanProduct; variant: VariantDoc }> {
  if (!Types.ObjectId.isValid(productId) || !Types.ObjectId.isValid(variantId)) throw new AppError("NOT_FOUND");
  const product = await Product.findOne({ _id: productId, status: "active" }).lean<LeanProduct>();
  const variant = product?.variants.find((v) => String(v._id) === variantId && v.active);
  if (!product || !variant) throw new AppError("NOT_FOUND", "This product is not available.");
  return { product, variant };
}

function stockConflict(variant: VariantDoc, requested: number): AppError {
  return new AppError("OUT_OF_STOCK", undefined, [{ sku: variant.sku, requested, available: Math.max(0, variant.stock) }]);
}

export async function addItem(owner: CartOwner, input: { productId: string; variantId: string; quantity: number }): Promise<HydratedDocument<CartDoc>> {
  const { product, variant } = await loadSellable(input.productId, input.variantId);
  const cart = await getOrCreateCart(owner);
  const existing = cart.items.find((i) => String(i.variantId) === input.variantId);
  const nextQty = (existing?.quantity ?? 0) + input.quantity;
  if (nextQty > MAX_LINE_QTY) throw new AppError("VALIDATION_FAILED", undefined, [{ path: "quantity", message: `Maximum ${MAX_LINE_QTY} per item` }]);
  if (variant.stock < nextQty) throw stockConflict(variant, nextQty);
  if (existing) {
    existing.quantity = nextQty;
    existing.priceAtAdd = effectivePrice(variant);
  } else {
    if (cart.items.length >= MAX_CART_LINES) throw new AppError("VALIDATION_FAILED", undefined, [{ path: "items", message: "Cart is full" }]);
    cart.items.push({ productId: product._id, variantId: variant._id, quantity: nextQty, priceAtAdd: effectivePrice(variant), addedAt: new Date() });
  }
  await cart.save();
  return cart;
}

export async function updateItem(owner: CartOwner, itemId: string, quantity: number): Promise<HydratedDocument<CartDoc>> {
  const cart = await findCart(owner);
  const item = cart?.items.find((i) => String(i._id) === itemId);
  if (!cart || !item) throw new AppError("NOT_FOUND");
  const product = await Product.findOne({ _id: item.productId, status: "active" }).lean<LeanProduct>();
  const variant = product?.variants.find((v) => String(v._id) === String(item.variantId) && v.active);
  if (!product || !variant) throw new AppError("NOT_FOUND", "This product is no longer available.");
  if (variant.stock < quantity) throw stockConflict(variant, quantity);
  item.quantity = quantity;
  item.priceAtAdd = effectivePrice(variant);
  await cart.save();
  return cart;
}

export async function removeItem(owner: CartOwner, itemId: string): Promise<HydratedDocument<CartDoc>> {
  const cart = await findCart(owner);
  if (!cart || !cart.items.some((i) => String(i._id) === itemId)) throw new AppError("NOT_FOUND");
  cart.items.pull({ _id: itemId });
  await cart.save();
  return cart;
}

export async function clearCart(owner: CartOwner): Promise<HydratedDocument<CartDoc> | null> {
  const cart = await findCart(owner);
  if (!cart) return null;
  cart.items.splice(0, cart.items.length);
  await cart.save();
  return cart;
}

/**
 * Merges a guest cart into the user's cart (idempotent: the guest cart is removed and
 * its hash remembered). Quantities are summed and capped at availability and 99.
 */
export async function mergeGuestCart(sessionHash: string, userId: Types.ObjectId): Promise<void> {
  await connectDb();
  const guest = await Cart.findOne({ sessionHash });
  if (!guest || guest.items.length === 0) {
    if (guest) await Cart.deleteOne({ _id: guest._id });
    return;
  }
  const userCart = await getOrCreateCart({ userId });
  if (userCart.mergedSessionHashes.includes(sessionHash)) {
    await Cart.deleteOne({ _id: guest._id });
    return;
  }
  const products = await loadProducts(guest.items.map((i) => i.productId));
  for (const g of guest.items) {
    const product = products.get(String(g.productId));
    const variant = product?.variants.find((v) => String(v._id) === String(g.variantId));
    if (!product || product.status !== "active" || !variant || !variant.active || variant.stock <= 0) continue;
    const existing = userCart.items.find((i) => String(i.variantId) === String(g.variantId));
    const qty = Math.min(MAX_LINE_QTY, variant.stock, (existing?.quantity ?? 0) + g.quantity);
    if (existing) {
      existing.quantity = qty;
      existing.priceAtAdd = effectivePrice(variant);
    } else if (userCart.items.length < MAX_CART_LINES) {
      userCart.items.push({ productId: g.productId, variantId: g.variantId, quantity: qty, priceAtAdd: effectivePrice(variant), addedAt: new Date() });
    }
  }
  userCart.mergedSessionHashes.push(sessionHash);
  if (userCart.mergedSessionHashes.length > 20) userCart.mergedSessionHashes.splice(0, userCart.mergedSessionHashes.length - 20);
  await userCart.save();
  await Cart.deleteOne({ _id: guest._id });
}
