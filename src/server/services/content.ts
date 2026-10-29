import type { BlogCard, BlogPost as BlogPostDto, Locale, PageMeta } from "@/lib/api/types";
import { connectDb } from "../db";
import { isDuplicateKeyError } from "../errors";
import { tr } from "../i18n";
import { BlogPost, ContactMessage, NewsletterSubscription, Product, type BlogPostDoc } from "../models";
import { queueEmail } from "../email/send";
import { escapeRegex, imageDto, pageMeta } from "./dto";

function blogCard(p: BlogPostDoc, locale: Locale): BlogCard {
  const title = tr(p.title, locale);
  return {
    slug: p.slug,
    title,
    excerpt: tr(p.excerpt, locale),
    coverImage: imageDto(p.coverImage, locale, title),
    category: p.category,
    readMinutes: p.readMinutes,
    publishedAt: (p.publishedAt ?? p.createdAt).toISOString(),
  };
}

export async function listBlogPosts(
  input: { page?: number; pageSize?: number; category?: string; q?: string },
  locale: Locale,
): Promise<{ items: BlogCard[]; meta: PageMeta }> {
  await connectDb();
  const page = Math.max(1, Math.min(1000, Math.floor(input.page ?? 1)));
  const pageSize = Math.max(1, Math.min(24, Math.floor(input.pageSize ?? 9)));
  const filter: Record<string, unknown> = { status: "published", publishedAt: { $lte: new Date() } };
  if (input.category && /^[a-z0-9-]{1,40}$/.test(input.category)) filter.category = input.category;
  if (input.q) {
    const re = { $regex: escapeRegex(input.q.slice(0, 64)), $options: "i" };
    filter.$or = [{ "title.hy": re }, { "title.ru": re }, { "title.en": re }, { tags: re }];
  }
  const [docs, total] = await Promise.all([
    BlogPost.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean<BlogPostDoc[]>(),
    BlogPost.countDocuments(filter),
  ]);
  return { items: docs.map((d) => blogCard(d, locale)), meta: pageMeta(page, pageSize, total) };
}

export async function getBlogPost(slug: string, locale: Locale): Promise<BlogPostDto | null> {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  await connectDb();
  const p = await BlogPost.findOne({ slug, status: "published", publishedAt: { $lte: new Date() } }).lean<BlogPostDoc>();
  if (!p) return null;
  return { ...blogCard(p, locale), body: tr(p.body, locale), tags: p.tags };
}

export async function submitContact(input: { name: string; email: string; phone?: string; subject: string; message: string; locale: Locale }): Promise<string> {
  await connectDb();
  const doc = await ContactMessage.create({ ...input, phone: input.phone ?? "" });
  await queueEmail({ to: input.email, template: "contact_receipt", locale: input.locale, data: { name: input.name } }, `contact:${String(doc._id)}`);
  return String(doc._id);
}

export async function subscribeNewsletter(email: string, locale: Locale): Promise<void> {
  await connectDb();
  try {
    await NewsletterSubscription.create({ email, locale });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err; // repeats are silently accepted (no enumeration)
  }
}

export async function listSitemapEntries(): Promise<{ products: { slug: string; updatedAt: string }[]; posts: { slug: string; updatedAt: string }[] }> {
  await connectDb();
  const [products, posts] = await Promise.all([
    Product.find({ status: "active" }, { slug: 1, updatedAt: 1 }).lean<{ slug: string; updatedAt: Date }[]>(),
    BlogPost.find({ status: "published", publishedAt: { $lte: new Date() } }, { slug: 1, updatedAt: 1 }).lean<{ slug: string; updatedAt: Date }[]>(),
  ]);
  return {
    products: products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt.toISOString() })),
    posts: posts.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt.toISOString() })),
  };
}
