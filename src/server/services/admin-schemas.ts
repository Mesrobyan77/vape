import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/api/types";
import { localizedInput } from "../i18n";

export const objectIdString = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
export const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, digits and dashes").max(80);

/** Only our own static media, Cloudinary or Pexels — never arbitrary remote URLs (SSRF / mixed content). */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (u) => /^\/media\/[A-Za-z0-9/_.-]+$/.test(u) || /^https:\/\/res\.cloudinary\.com\/[^\s]+$/.test(u) || /^https:\/\/images\.pexels\.com\/[^\s]+$/.test(u),
    "Image must be a /media path, a Cloudinary URL or a Pexels URL",
  );

export const imageInput = z
  .object({
    url: imageUrlSchema,
    publicId: z.string().max(200).nullable().optional(),
    alt: localizedInput({ max: 200, requiredHy: false }).optional(),
    width: z.number().int().min(1).max(10000),
    height: z.number().int().min(1).max(10000),
  })
  .strict();

const variantAttributes = z
  .object({
    flavor: z.string().trim().max(60).nullable().optional(),
    nicotineMg: z.number().int().min(0).max(50).nullable().optional(),
    volumeMl: z.number().int().min(0).max(1000).nullable().optional(),
    color: z.string().trim().max(40).nullable().optional(),
    resistanceOhm: z.number().min(0).max(10).nullable().optional(),
  })
  .strict();

export const variantInput = z
  .object({
    sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,64}$/, "SKU: letters, digits, dashes"),
    attributes: variantAttributes.default({}),
    label: localizedInput({ max: 120, requiredHy: false }).optional(),
    price: z.number().int().min(1).max(10_000_000),
    salePrice: z.number().int().min(1).max(10_000_000).nullable().optional(),
    stock: z.number().int().min(0).max(1_000_000),
    images: z.array(imageInput).max(10).default([]),
    active: z.boolean().default(true),
  })
  .strict()
  .refine((v) => v.salePrice === null || v.salePrice === undefined || v.salePrice < v.price, { message: "salePrice must be lower than price", path: ["salePrice"] });

export const variantUpdateInput = z
  .object({
    attributes: variantAttributes.optional(),
    label: localizedInput({ max: 120, requiredHy: false }).optional(),
    price: z.number().int().min(1).max(10_000_000).optional(),
    salePrice: z.number().int().min(1).max(10_000_000).nullable().optional(),
    images: z.array(imageInput).max(10).optional(),
    active: z.boolean().optional(),
  })
  .strict();

const productBase = {
  slug: slugSchema,
  name: localizedInput({ max: 120 }),
  shortDescription: localizedInput({ max: 300, requiredHy: false }).optional(),
  description: localizedInput({ max: 8000, requiredHy: false }).optional(),
  brandId: objectIdString.nullable().optional(),
  categoryId: objectIdString.nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().max(40)).max(20).optional(),
  images: z.array(imageInput).max(12).optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
  featured: z.boolean().optional(),
  warnings: z.array(localizedInput({ max: 400, requiredHy: false })).max(5).optional(),
  seo: z.object({ title: localizedInput({ max: 120, requiredHy: false }), description: localizedInput({ max: 300, requiredHy: false }) }).strict().optional(),
};

export const productCreateInput = z.object({ ...productBase, variants: z.array(variantInput).min(1).max(50) }).strict();

export const productUpdateInput = z
  .object({
    slug: productBase.slug.optional(),
    name: productBase.name.optional(),
    shortDescription: productBase.shortDescription,
    description: productBase.description,
    brandId: productBase.brandId,
    categoryId: productBase.categoryId,
    tags: productBase.tags,
    images: productBase.images,
    status: productBase.status,
    featured: productBase.featured,
    warnings: productBase.warnings,
    seo: productBase.seo,
  })
  .strict();

export const inventoryAdjustInput = z
  .object({
    productId: objectIdString,
    variantId: objectIdString,
    delta: z.number().int().min(-100_000).max(100_000).refine((n) => n !== 0, "delta must not be 0"),
    reason: z.string().trim().min(3).max(200),
  })
  .strict();

export const categoryInput = z
  .object({
    slug: slugSchema,
    name: localizedInput({ max: 80 }),
    description: localizedInput({ max: 500, requiredHy: false }).optional(),
    image: imageInput.nullable().optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const brandInput = z
  .object({
    slug: slugSchema,
    name: z.string().trim().min(1).max(80),
    logo: imageInput.nullable().optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const orderTransitionInput = z
  .object({
    to: z.enum(ORDER_STATUSES),
    note: z.string().trim().max(500).optional(),
    confirm: z.boolean().optional(),
  })
  .strict();

export const userUpdateInput = z.object({ active: z.boolean() }).strict();

export const blogInput = z
  .object({
    slug: slugSchema,
    title: localizedInput({ max: 160 }),
    excerpt: localizedInput({ max: 400, requiredHy: false }).optional(),
    body: localizedInput({ max: 20000, requiredHy: false }).optional(),
    coverImage: imageInput.nullable().optional(),
    category: slugSchema.optional(),
    tags: z.array(z.string().trim().toLowerCase().max(40)).max(20).optional(),
    readMinutes: z.number().int().min(1).max(120).optional(),
    status: z.enum(["draft", "published"]).optional(),
    publishedAt: z.coerce.date().nullable().optional(),
  })
  .strict();

export const couponInput = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,40}$/),
    type: z.enum(["percent", "fixed"]),
    value: z.number().int().min(1).max(10_000_000),
    minSubtotal: z.number().int().min(0).max(10_000_000).optional(),
    active: z.boolean().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    usageLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
  })
  .strict()
  .refine((c) => c.type !== "percent" || c.value <= 100, { message: "percent must be ≤ 100", path: ["value"] });

export const bannerInput = z
  .object({
    title: localizedInput({ max: 120 }),
    subtitle: localizedInput({ max: 240, requiredHy: false }).optional(),
    image: imageInput.nullable().optional(),
    link: z.string().trim().max(300).regex(/^\/[A-Za-z0-9/_?=&.,-]*$/, "Internal path only"),
    placement: z.enum(["hero", "promo"]).optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

export const settingsInput = z
  .object({
    vatRatePercent: z.number().min(0).max(50),
    shipping: z
      .object({
        yerevanFee: z.number().int().min(0).max(1_000_000),
        otherFee: z.number().int().min(0).max(1_000_000),
        freeThreshold: z.number().int().min(0).max(100_000_000),
      })
      .strict(),
    reservationTtlMinutes: z.number().int().min(5).max(1440),
    banners: z.array(bannerInput).max(20),
    store: z
      .object({
        phone: z.string().trim().max(40),
        email: z.string().trim().email().max(254),
        address: localizedInput({ max: 200, requiredHy: false }),
        hours: localizedInput({ max: 120, requiredHy: false }),
      })
      .strict(),
  })
  .strict();

export const contactStatusInput = z.object({ status: z.enum(["new", "read", "archived"]) }).strict();

export const pageQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(100).optional(),
    status: z.string().trim().max(40).optional(),
    action: z.string().trim().max(60).optional(),
    productId: objectIdString.optional(),
  })
  .passthrough();
