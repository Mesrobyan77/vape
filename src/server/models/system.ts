import { Schema, type Types } from 'mongoose';
import type { Localized } from '@/lib/api/types';
import { defineModel, ImageSchema, LocalizedSchema, type ImageRef } from './common';

/* ----------------------------- Outbox ----------------------------- */

export type OutboxStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'dead';

export interface OutboxDoc {
  _id: Types.ObjectId;
  type: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  lockedUntil: Date | null;
  lastError: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OutboxSchema = new Schema<OutboxDoc>(
  {
    type: { type: String, required: true },
    dedupeKey: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['pending', 'processing', 'sent', 'failed', 'dead'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 6 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lockedUntil: { type: Date, default: null },
    lastError: { type: String, default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// Exactly-once enqueue: duplicate events (e.g. repeated payment callbacks) collapse.
OutboxSchema.index({ dedupeKey: 1 }, { unique: true });
OutboxSchema.index({ status: 1, nextAttemptAt: 1 });
export const Outbox = defineModel<OutboxDoc>('Outbox', OutboxSchema);

export interface CapturedEmailDoc {
  _id: Types.ObjectId;
  to: string;
  subject: string;
  text: string;
  html: string;
  template: string;
  createdAt: Date;
}
const CapturedEmailSchema = new Schema<CapturedEmailDoc>({
  to: { type: String, required: true },
  subject: String,
  text: String,
  html: String,
  template: String,
  createdAt: { type: Date, default: () => new Date() },
});
CapturedEmailSchema.index({ to: 1, createdAt: -1 });
export const CapturedEmail = defineModel<CapturedEmailDoc>('CapturedEmail', CapturedEmailSchema);

/* ---------------------------- Audit log ---------------------------- */

export interface AuditLogDoc {
  _id: Types.ObjectId;
  actorId: Types.ObjectId | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  changes: Record<string, unknown>;
  requestId: string | null;
  ip: string | null;
  createdAt: Date;
}
const AuditLogSchema = new Schema<AuditLogDoc>({
  actorId: { type: Schema.Types.ObjectId, default: null },
  actorEmail: { type: String, default: null },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: String, default: null },
  changes: { type: Schema.Types.Mixed, default: {} },
  requestId: { type: String, default: null },
  ip: { type: String, default: null },
  createdAt: { type: Date, default: () => new Date(), immutable: true },
});
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });
export const AuditLog = defineModel<AuditLogDoc>('AuditLog', AuditLogSchema);

/* ----------------------------- Content ----------------------------- */

export interface BlogPostDoc {
  _id: Types.ObjectId;
  slug: string;
  title: Localized;
  excerpt: Localized;
  body: Localized;
  coverImage: ImageRef | null;
  category: string;
  tags: string[];
  readMinutes: number;
  status: 'draft' | 'published';
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
const BlogPostSchema = new Schema<BlogPostDoc>(
  {
    slug: { type: String, required: true },
    title: { type: LocalizedSchema, required: true },
    excerpt: { type: LocalizedSchema, default: () => ({ hy: '', ru: '', en: '' }) },
    body: { type: LocalizedSchema, default: () => ({ hy: '', ru: '', en: '' }) },
    coverImage: { type: ImageSchema, default: null },
    category: { type: String, default: 'news' },
    tags: { type: [String], default: [] },
    readMinutes: { type: Number, default: 3 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
BlogPostSchema.index({ slug: 1 }, { unique: true });
BlogPostSchema.index({ status: 1, publishedAt: -1 });
BlogPostSchema.index({ status: 1, category: 1 });
export const BlogPost = defineModel<BlogPostDoc>('BlogPost', BlogPostSchema);

export interface ContactMessageDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  locale: string;
  status: 'new' | 'read' | 'archived';
  createdAt: Date;
}
const ContactMessageSchema = new Schema<ContactMessageDoc>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  locale: { type: String, default: 'hy' },
  status: { type: String, enum: ['new', 'read', 'archived'], default: 'new' },
  createdAt: { type: Date, default: () => new Date() },
});
ContactMessageSchema.index({ status: 1, createdAt: -1 });
export const ContactMessage = defineModel<ContactMessageDoc>('ContactMessage', ContactMessageSchema);

export interface NewsletterDoc {
  _id: Types.ObjectId;
  email: string;
  locale: string;
  createdAt: Date;
}
const NewsletterSchema = new Schema<NewsletterDoc>({
  email: { type: String, required: true },
  locale: { type: String, default: 'hy' },
  createdAt: { type: Date, default: () => new Date() },
});
NewsletterSchema.index({ email: 1 }, { unique: true });
export const NewsletterSubscription = defineModel<NewsletterDoc>('NewsletterSubscription', NewsletterSchema);

/* ------------------------------ Media ------------------------------ */

export interface MediaDoc {
  _id: Types.ObjectId;
  publicId: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  uploadedBy: Types.ObjectId | null;
  deletedAt: Date | null;
  createdAt: Date;
}
const MediaSchema = new Schema<MediaDoc>({
  publicId: { type: String, required: true },
  url: { type: String, required: true },
  width: Number,
  height: Number,
  format: String,
  bytes: Number,
  uploadedBy: { type: Schema.Types.ObjectId, default: null },
  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: () => new Date() },
});
MediaSchema.index({ publicId: 1 }, { unique: true });
MediaSchema.index({ deletedAt: 1, createdAt: 1 });
export const Media = defineModel<MediaDoc>('Media', MediaSchema);

/* --------------------------- Rate limits --------------------------- */

export interface RateLimitHitDoc {
  _id: string;
  hits: number;
  resetAt: Date;
}
const RateLimitHitSchema = new Schema<RateLimitHitDoc>({
  _id: { type: String, required: true },
  hits: { type: Number, default: 0 },
  resetAt: { type: Date, required: true },
});
RateLimitHitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });
export const RateLimitHit = defineModel<RateLimitHitDoc>('RateLimitHit', RateLimitHitSchema);
