import { Schema, type Types } from "mongoose";
import type { Localized } from "@/lib/api/types";
import { defineModel, ImageSchema, LocalizedSchema, type ImageRef } from "./common";

const emptyL = () => ({ hy: "", ru: "", en: "" });

export interface CategoryDoc {
  _id: Types.ObjectId;
  slug: string;
  name: Localized;
  description: Localized;
  image: ImageRef | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<CategoryDoc>(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    name: { type: LocalizedSchema, required: true },
    description: { type: LocalizedSchema, default: emptyL },
    image: { type: ImageSchema, default: null },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ active: 1, sortOrder: 1 });
export const Category = defineModel<CategoryDoc>("Category", CategorySchema);

export interface BrandDoc {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  logo: ImageRef | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema = new Schema<BrandDoc>(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    logo: { type: ImageSchema, default: null },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
BrandSchema.index({ slug: 1 }, { unique: true });
export const Brand = defineModel<BrandDoc>("Brand", BrandSchema);

export interface VariantAttributes {
  flavor?: string | null;
  nicotineMg?: number | null;
  volumeMl?: number | null;
  color?: string | null;
  resistanceOhm?: number | null;
}

export interface VariantDoc {
  _id: Types.ObjectId;
  sku: string;
  attributes: VariantAttributes;
  label: Localized;
  price: number;
  salePrice: number | null;
  stock: number;
  images: ImageRef[];
  active: boolean;
}

export type ProductStatus = "active" | "draft" | "archived";

export interface ProductDoc {
  _id: Types.ObjectId;
  slug: string;
  name: Localized;
  shortDescription: Localized;
  description: Localized;
  brandId: Types.ObjectId | null;
  categoryId: Types.ObjectId | null;
  tags: string[];
  images: ImageRef[];
  variants: Types.DocumentArray<VariantDoc>;
  status: ProductStatus;
  featured: boolean;
  salesCount: number;
  minPrice: number;
  flavors: string[];
  nicotineLevels: number[];
  warnings: Localized[];
  seo: { title: Localized; description: Localized };
  searchText: string;
  createdAt: Date;
  updatedAt: Date;
}

const VariantSchema = new Schema<VariantDoc>({
  sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
  attributes: {
    flavor: { type: String, default: null },
    nicotineMg: { type: Number, default: null, min: 0, max: 50 },
    volumeMl: { type: Number, default: null, min: 0 },
    color: { type: String, default: null },
    resistanceOhm: { type: Number, default: null, min: 0 },
  },
  label: { type: LocalizedSchema, default: emptyL },
  price: {
    type: Number,
    required: true,
    min: 1,
    validate: { validator: Number.isInteger, message: "price must be an integer AMD amount" },
  },
  salePrice: {
    type: Number,
    default: null,
    validate: {
      validator(this: VariantDoc, v: number | null) {
        return v === null || (Number.isInteger(v) && v >= 1 && v < this.price);
      },
      message: "salePrice must be an integer lower than price",
    },
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    validate: { validator: Number.isInteger, message: "stock must be an integer" },
  },
  images: { type: [ImageSchema], default: [] },
  active: { type: Boolean, default: true },
});

const ProductSchema = new Schema<ProductDoc>(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    name: { type: LocalizedSchema, required: true },
    shortDescription: { type: LocalizedSchema, default: emptyL },
    description: { type: LocalizedSchema, default: emptyL },
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    tags: { type: [String], default: [] },
    images: { type: [ImageSchema], default: [] },
    variants: { type: [VariantSchema], default: [] },
    status: { type: String, enum: ["active", "draft", "archived"], default: "draft" },
    featured: { type: Boolean, default: false },
    salesCount: { type: Number, default: 0 },
    minPrice: { type: Number, default: 0 },
    flavors: { type: [String], default: [] },
    nicotineLevels: { type: [Number], default: [] },
    warnings: { type: [LocalizedSchema], default: [] },
    seo: {
      title: { type: LocalizedSchema, default: emptyL },
      description: { type: LocalizedSchema, default: emptyL },
    },
    searchText: { type: String, default: "" },
  },
  { timestamps: true },
);

export function effectivePrice(v: Pick<VariantDoc, "price" | "salePrice">): number {
  return v.salePrice !== null && v.salePrice !== undefined && v.salePrice < v.price ? v.salePrice : v.price;
}

export function slugifyValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Recomputes denormalized fields used for filtering/sorting. Runs before every validate/save. */
export function refreshDenormalized(product: Pick<ProductDoc, "variants" | "name" | "slug" | "tags" | "minPrice" | "flavors" | "nicotineLevels" | "searchText">): void {
  const active = product.variants.filter((v) => v.active);
  product.minPrice = active.length ? Math.min(...active.map(effectivePrice)) : 0;
  product.flavors = [
    ...new Set(
      active
        .map((v) => v.attributes?.flavor)
        .filter((f): f is string => !!f)
        .map(slugifyValue)
        .filter(Boolean),
    ),
  ];
  product.nicotineLevels = [
    ...new Set(active.map((v) => v.attributes?.nicotineMg).filter((n): n is number => typeof n === "number")),
  ].sort((a, b) => a - b);
  product.searchText = [product.name.hy, product.name.ru, product.name.en, product.slug, ...product.tags, ...active.map((v) => v.sku)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

ProductSchema.pre("validate", function () {
  const skus = this.variants.map((v) => v.sku.toUpperCase());
  if (new Set(skus).size !== skus.length) {
    const err = new Error("DUPLICATE_SKU_IN_PRODUCT") as Error & { code: number; keyPattern: Record<string, number> };
    err.code = 11000;
    err.keyPattern = { "variants.sku": 1 };
    throw err;
  }
  refreshDenormalized(this);
});

ProductSchema.index({ slug: 1 }, { unique: true });
// Unique SKU across all products (multikey). In-document duplicates are rejected in pre('validate').
ProductSchema.index({ "variants.sku": 1 }, { unique: true });
ProductSchema.index({ status: 1, categoryId: 1, createdAt: -1 });
ProductSchema.index({ status: 1, brandId: 1 });
ProductSchema.index({ status: 1, minPrice: 1 });
ProductSchema.index({ status: 1, salesCount: -1 });
ProductSchema.index({ status: 1, featured: 1 });
ProductSchema.index({ status: 1, flavors: 1 });
ProductSchema.index({ status: 1, nicotineLevels: 1 });

export const Product = defineModel<ProductDoc>("Product", ProductSchema);

export interface InventoryMovementDoc {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  delta: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  kind: "admin_adjustment" | "order" | "release" | "test";
  actorId: Types.ObjectId | null;
  createdAt: Date;
}

const InventoryMovementSchema = new Schema<InventoryMovementDoc>({
  productId: { type: Schema.Types.ObjectId, required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  sku: { type: String, required: true },
  delta: { type: Number, required: true },
  stockBefore: { type: Number, required: true },
  stockAfter: { type: Number, required: true },
  reason: { type: String, required: true },
  kind: { type: String, required: true },
  actorId: { type: Schema.Types.ObjectId, default: null },
  createdAt: { type: Date, default: () => new Date() },
});
InventoryMovementSchema.index({ productId: 1, createdAt: -1 });
InventoryMovementSchema.index({ createdAt: -1 });
export const InventoryMovement = defineModel<InventoryMovementDoc>("InventoryMovement", InventoryMovementSchema);
