import { Types, type FilterQuery } from "mongoose";
import { z } from "zod";
import {
  SORT_OPTIONS,
  type Brand as BrandDto,
  type Category as CategoryDto,
  type Facets,
  type Locale,
  type PageMeta,
  type ProductCard,
  type ProductDetail,
  type ProductQuery,
  type SearchSuggestion,
  type Variant,
} from "@/lib/api/types";
import { connectDb } from "../db";
import { tr } from "../i18n";
import { Brand, Category, Product, effectivePrice, slugifyValue, type BrandDoc, type CategoryDoc, type ProductDoc, type VariantDoc } from "../models";
import { escapeRegex, imageDto, pageMeta } from "./dto";

const NEW_WINDOW_MS = 30 * 86_400_000;
export const MAX_PAGE_SIZE = 48;

/* ------------------------------------------------------------ queries */

const csv = (item: z.ZodType<string, string>) =>
  z
    .string()
    .max(500)
    .transform((s) => s.split(",").map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(item).max(20));

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

/** Strict API query schema → 422 on invalid values. */
export const productQuerySchema = z
  .object({
    locale: z.enum(["hy", "ru", "en"]).optional(),
    page: z.coerce.number().int().min(1).max(1000).optional(),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
    sort: z.enum(SORT_OPTIONS).optional(),
    q: z.string().trim().max(64).optional(),
    category: csv(slug).optional(),
    brand: csv(slug).optional(),
    flavor: csv(slug).optional(),
    nicotine: z
      .string()
      .max(100)
      .transform((s) => s.split(",").map((v) => v.trim()).filter(Boolean))
      .pipe(z.array(z.string().regex(/^\d{1,2}$/).transform(Number).pipe(z.number().int().min(0).max(50))).max(10))
      .optional(),
    minPrice: z.coerce.number().int().min(0).max(10_000_000).optional(),
    maxPrice: z.coerce.number().int().min(0).max(10_000_000).optional(),
    inStock: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
    featured: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  })
  .passthrough()
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: "minPrice must not exceed maxPrice",
    path: ["minPrice"],
  });

export function toProductQuery(q: z.output<typeof productQuerySchema>): ProductQuery {
  return {
    page: q.page,
    pageSize: q.pageSize,
    sort: q.sort,
    q: q.q || undefined,
    category: q.category,
    brand: q.brand,
    flavor: q.flavor,
    nicotine: q.nicotine,
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    inStock: q.inStock,
    featured: q.featured,
  };
}

/** Lenient parser for page URLs: invalid values are silently dropped (pages never crash). */
export function parseProductQuery(sp: Record<string, string | string[] | undefined>): ProductQuery {
  const first = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v.join(",") : v;
  };
  const out: ProductQuery = {};
  const int = (k: string, min: number, max: number): number | undefined => {
    const raw = first(k);
    if (raw === undefined || !/^\d{1,9}$/.test(raw)) return undefined;
    const n = Number(raw);
    return n >= min && n <= max ? n : undefined;
  };
  const list = (k: string) => {
    const raw = first(k);
    if (!raw) return undefined;
    const items = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[a-z0-9-]{1,80}$/.test(s))
      .slice(0, 20);
    return items.length ? items : undefined;
  };
  out.page = int("page", 1, 1000);
  out.pageSize = int("pageSize", 1, MAX_PAGE_SIZE);
  const sort = first("sort");
  if (sort && (SORT_OPTIONS as readonly string[]).includes(sort)) out.sort = sort as ProductQuery["sort"];
  const q = first("q")?.trim().slice(0, 64);
  if (q) out.q = q;
  out.category = list("category");
  out.brand = list("brand");
  out.flavor = list("flavor");
  const nic = first("nicotine")
    ?.split(",")
    .filter((s) => /^\d{1,2}$/.test(s.trim()))
    .map(Number)
    .filter((n) => n <= 50)
    .slice(0, 10);
  if (nic?.length) out.nicotine = nic;
  out.minPrice = int("minPrice", 0, 10_000_000);
  out.maxPrice = int("maxPrice", 0, 10_000_000);
  if (out.minPrice !== undefined && out.maxPrice !== undefined && out.minPrice > out.maxPrice) {
    out.minPrice = undefined;
    out.maxPrice = undefined;
  }
  if (first("inStock") === "true") out.inStock = true;
  if (first("featured") === "true") out.featured = true;
  for (const key of Object.keys(out) as (keyof ProductQuery)[]) if (out[key] === undefined) delete out[key];
  return out;
}

/* ------------------------------------------------------------- DTOs */

interface TaxonomyMaps {
  categories: Map<string, CategoryDoc>;
  brands: Map<string, BrandDoc>;
}

async function taxonomyMaps(): Promise<TaxonomyMaps> {
  const [cats, brands] = await Promise.all([Category.find({}).lean<CategoryDoc[]>(), Brand.find({}).lean<BrandDoc[]>()]);
  return {
    categories: new Map(cats.map((c) => [String(c._id), c])),
    brands: new Map(brands.map((b) => [String(b._id), b])),
  };
}

type LeanProduct = Omit<ProductDoc, "variants"> & { variants: VariantDoc[] };

const activeVariants = (p: LeanProduct) => p.variants.filter((v) => v.active);

export function cardOf(p: LeanProduct, locale: Locale, maps: TaxonomyMaps, now = Date.now()): ProductCard {
  const variants = activeVariants(p);
  const cheapest = variants.reduce<VariantDoc | null>((best, v) => (best === null || effectivePrice(v) < effectivePrice(best) ? v : best), null);
  const purchasable = variants.filter((v) => v.stock > 0);
  const brand = p.brandId ? maps.brands.get(String(p.brandId)) : undefined;
  const category = p.categoryId ? maps.categories.get(String(p.categoryId)) : undefined;
  const name = tr(p.name, locale);
  return {
    id: String(p._id),
    slug: p.slug,
    name,
    shortDescription: tr(p.shortDescription, locale),
    brand: brand ? { slug: brand.slug, name: brand.name } : null,
    category: category ? { slug: category.slug, name: tr(category.name, locale) } : null,
    image: imageDto(p.images[0], locale, name),
    price: cheapest ? effectivePrice(cheapest) : 0,
    compareAtPrice: cheapest && cheapest.salePrice !== null && cheapest.salePrice < cheapest.price ? cheapest.price : null,
    inStock: purchasable.length > 0,
    isNew: now - new Date(p.createdAt).getTime() < NEW_WINDOW_MS,
    featured: p.featured,
    defaultVariantId: purchasable.length === 1 && variants.length === 1 ? String(purchasable[0]!._id) : null,
    variantCount: variants.length,
  };
}

export function variantLabel(v: VariantDoc, locale: Locale): string {
  const explicit = tr(v.label, locale);
  if (explicit) return explicit;
  const a = v.attributes ?? {};
  const parts: string[] = [];
  if (a.flavor) parts.push(a.flavor);
  if (typeof a.nicotineMg === "number") parts.push(`${a.nicotineMg} mg`);
  if (typeof a.volumeMl === "number") parts.push(`${a.volumeMl} ml`);
  if (a.color) parts.push(a.color);
  if (typeof a.resistanceOhm === "number") parts.push(`${a.resistanceOhm} Ω`);
  return parts.join(" · ") || v.sku;
}

function variantDto(v: VariantDoc, locale: Locale, productName: string): Variant {
  const onSale = v.salePrice !== null && v.salePrice < v.price;
  return {
    id: String(v._id),
    sku: v.sku,
    label: variantLabel(v, locale),
    attributes: {
      flavor: v.attributes?.flavor ?? null,
      nicotineMg: v.attributes?.nicotineMg ?? null,
      volumeMl: v.attributes?.volumeMl ?? null,
      color: v.attributes?.color ?? null,
      resistanceOhm: v.attributes?.resistanceOhm ?? null,
    },
    price: effectivePrice(v),
    compareAtPrice: onSale ? v.price : null,
    available: Math.max(0, v.stock),
    images: v.images.map((i) => imageDto(i, locale, productName)).filter((i): i is NonNullable<typeof i> => i !== null),
  };
}

/* ---------------------------------------------------------- filters */

async function resolveIds(model: "category" | "brand", slugs: string[] | undefined): Promise<Types.ObjectId[] | undefined> {
  if (!slugs?.length) return undefined;
  const docs =
    model === "category"
      ? await Category.find({ slug: { $in: slugs } }, { _id: 1 }).lean()
      : await Brand.find({ slug: { $in: slugs } }, { _id: 1 }).lean();
  return docs.map((d) => d._id as Types.ObjectId);
}

type FilterPart = "category" | "brand" | "flavor" | "nicotine" | "price";

async function buildFilter(query: ProductQuery, omit?: FilterPart): Promise<FilterQuery<ProductDoc>> {
  const filter: FilterQuery<ProductDoc> = { status: "active" };
  const and: FilterQuery<ProductDoc>[] = [];
  if (omit !== "category") {
    const ids = await resolveIds("category", query.category);
    if (ids) filter.categoryId = { $in: ids };
  }
  if (omit !== "brand") {
    const ids = await resolveIds("brand", query.brand);
    if (ids) filter.brandId = { $in: ids };
  }
  if (omit !== "flavor" && query.flavor?.length) filter.flavors = { $in: query.flavor };
  if (omit !== "nicotine" && query.nicotine?.length) filter.nicotineLevels = { $in: query.nicotine };
  if (omit !== "price" && (query.minPrice !== undefined || query.maxPrice !== undefined)) {
    filter.minPrice = {
      ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
    };
  }
  if (query.inStock) {
    // "In stock" must hold for a variant that also matches the requested strength — a product
    // whose 12 mg variant is sold out is not "in stock at 12 mg" just because 3 mg is available.
    const nicotine = omit !== "nicotine" && query.nicotine?.length ? { "attributes.nicotineMg": { $in: query.nicotine } } : {};
    filter.variants = { $elemMatch: { active: true, stock: { $gt: 0 }, ...nicotine } };
  }
  if (query.featured) filter.featured = true;
  if (query.q) and.push({ searchText: { $regex: escapeRegex(query.q.toLowerCase()), $options: "i" } });
  if (and.length) filter.$and = and;
  return filter;
}

const SORTS: Record<NonNullable<ProductQuery["sort"]>, Record<string, 1 | -1>> = {
  newest: { createdAt: -1, _id: -1 },
  "price-asc": { minPrice: 1, _id: 1 },
  "price-desc": { minPrice: -1, _id: -1 },
  popularity: { salesCount: -1, createdAt: -1, _id: -1 },
};

export async function listProducts(query: ProductQuery, locale: Locale): Promise<{ items: ProductCard[]; meta: PageMeta }> {
  await connectDb();
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? 12, MAX_PAGE_SIZE);
  const filter = await buildFilter(query);
  const [docs, total, maps] = await Promise.all([
    Product.find(filter)
      .sort(SORTS[query.sort ?? "newest"])
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .maxTimeMS(5000)
      .lean<LeanProduct[]>(),
    Product.countDocuments(filter).maxTimeMS(5000),
    taxonomyMaps(),
  ]);
  return { items: docs.map((d) => cardOf(d, locale, maps)), meta: pageMeta(page, pageSize, total) };
}

export async function getFacets(query: ProductQuery, locale: Locale): Promise<Facets> {
  await connectDb();
  const maps = await taxonomyMaps();
  const project = { categoryId: 1, brandId: 1, flavors: 1, nicotineLevels: 1, minPrice: 1, variants: 1 } as const;
  const [forCat, forBrand, forFlavor, forNic, forPrice] = await Promise.all(
    (["category", "brand", "flavor", "nicotine", "price"] as FilterPart[]).map(async (part) =>
      Product.find(await buildFilter(query, part), project).limit(2000).maxTimeMS(5000).lean<LeanProduct[]>(),
    ),
  );

  const count = <K extends string>(rows: LeanProduct[], keys: (p: LeanProduct) => K[]) => {
    const m = new Map<K, number>();
    for (const p of rows) for (const k of new Set(keys(p))) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };

  const catCounts = count(forCat!, (p) => (p.categoryId ? [String(p.categoryId)] : []));
  const brandCounts = count(forBrand!, (p) => (p.brandId ? [String(p.brandId)] : []));
  const flavorCounts = count(forFlavor!, (p) => p.flavors);
  const nicCounts = count(forNic!, (p) => p.nicotineLevels.map(String));

  const flavorLabels = new Map<string, string>();
  for (const p of forFlavor!) {
    for (const v of p.variants) {
      if (v.active && v.attributes?.flavor) flavorLabels.set(slugifyValue(v.attributes.flavor), v.attributes.flavor);
    }
  }

  const prices = forPrice!.map((p) => p.minPrice).filter((n) => n > 0);
  return {
    categories: [...catCounts.entries()]
      .map(([id, c]) => {
        const cat = maps.categories.get(id);
        return cat && cat.active ? { slug: cat.slug, name: tr(cat.name, locale), count: c, sort: cat.sortOrder } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.sort - b.sort)
      .map(({ slug: s, name, count: c }) => ({ slug: s, name, count: c })),
    brands: [...brandCounts.entries()]
      .map(([id, c]) => {
        const b = maps.brands.get(id);
        return b && b.active ? { slug: b.slug, name: b.name, count: c } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.name.localeCompare(b.name)),
    flavors: [...flavorCounts.entries()]
      .map(([value, c]) => ({ value, label: flavorLabels.get(value) ?? value, count: c }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    nicotine: [...nicCounts.entries()].map(([value, c]) => ({ value: Number(value), count: c })).sort((a, b) => a.value - b.value),
    price: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
  };
}

export async function suggestProducts(q: string, locale: Locale): Promise<SearchSuggestion[]> {
  await connectDb();
  const docs = await Product.find({ status: "active", searchText: { $regex: escapeRegex(q.toLowerCase()), $options: "i" } })
    .sort({ salesCount: -1 })
    .limit(6)
    .maxTimeMS(3000)
    .lean<LeanProduct[]>();
  return docs.map((p) => {
    const name = tr(p.name, locale);
    const variants = activeVariants(p);
    return {
      slug: p.slug,
      name,
      image: imageDto(p.images[0], locale, name),
      price: variants.length ? Math.min(...variants.map(effectivePrice)) : 0,
    };
  });
}

export async function getProduct(slugValue: string, locale: Locale): Promise<ProductDetail | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slugValue)) return null;
  await connectDb();
  const p = await Product.findOne({ slug: slugValue, status: "active" }).lean<LeanProduct>();
  if (!p) return null;
  const maps = await taxonomyMaps();
  const card = cardOf(p, locale, maps);
  const relatedDocs = await Product.find({
    status: "active",
    _id: { $ne: p._id },
    ...(p.categoryId ? { categoryId: p.categoryId } : { featured: true }),
  })
    .sort({ salesCount: -1 })
    .limit(8)
    .lean<LeanProduct[]>();
  let related = relatedDocs;
  if (related.length < 4) {
    const extra = await Product.find({ status: "active", _id: { $nin: [p._id, ...related.map((r) => r._id)] } })
      .sort({ featured: -1, salesCount: -1 })
      .limit(8 - related.length)
      .lean<LeanProduct[]>();
    related = [...related, ...extra];
  }
  const name = card.name;
  return {
    ...card,
    description: tr(p.description, locale),
    tags: p.tags,
    images: p.images.map((i) => imageDto(i, locale, name)).filter((i): i is NonNullable<typeof i> => i !== null),
    warnings: p.warnings.map((w) => tr(w, locale)).filter(Boolean),
    variants: activeVariants(p).map((v) => variantDto(v, locale, name)),
    seo: { title: tr(p.seo.title, locale) || name, description: tr(p.seo.description, locale) || card.shortDescription },
    related: related.map((r) => cardOf(r, locale, maps)),
  };
}

export async function listCategories(locale: Locale): Promise<CategoryDto[]> {
  await connectDb();
  const [cats, counts] = await Promise.all([
    Category.find({ active: true }).sort({ sortOrder: 1, _id: 1 }).lean<CategoryDoc[]>(),
    Product.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { status: "active" } }, { $group: { _id: "$categoryId", n: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
  return cats.map((c) => ({
    slug: c.slug,
    name: tr(c.name, locale),
    description: tr(c.description, locale),
    image: imageDto(c.image, locale, tr(c.name, locale)),
    productCount: countMap.get(String(c._id)) ?? 0,
  }));
}

export async function listBrands(): Promise<BrandDto[]> {
  await connectDb();
  const brands = await Brand.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean<BrandDoc[]>();
  return brands.map((b) => ({ slug: b.slug, name: b.name, logo: imageDto(b.logo, "en", b.name) }));
}
