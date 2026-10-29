import { Schema, type Types } from 'mongoose';
import type { Locale, Localized } from '@/lib/api/types';
import { defineModel, ImageSchema, LocalizedSchema, type ImageRef } from './common';

/* ----------------------------- Cart ----------------------------- */

export interface CartItemDoc {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  priceAtAdd: number;
  addedAt: Date;
}

export interface CartDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId | null;
  sessionHash: string | null;
  items: Types.DocumentArray<CartItemDoc>;
  mergedSessionHashes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema<CartItemDoc>({
  productId: { type: Schema.Types.ObjectId, required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, min: 1, max: 99 },
  priceAtAdd: { type: Number, required: true },
  addedAt: { type: Date, default: () => new Date() },
});

const CartSchema = new Schema<CartDoc>(
  {
    userId: { type: Schema.Types.ObjectId, default: null },
    sessionHash: { type: String, default: null },
    items: { type: [CartItemSchema], default: [] },
    mergedSessionHashes: { type: [String], default: [] },
  },
  { timestamps: true },
);
// One cart per user and one per guest session.
CartSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });
CartSchema.index({ sessionHash: 1 }, { unique: true, partialFilterExpression: { sessionHash: { $type: 'string' } } });
// Abandoned guest carts are cleaned after 60 days of inactivity.
CartSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 86_400, partialFilterExpression: { sessionHash: { $type: 'string' } } });
export const Cart = defineModel<CartDoc>('Cart', CartSchema);

/* ---------------------------- Coupons ---------------------------- */

export interface CouponDoc {
  _id: Types.ObjectId;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal: number;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<CouponDoc>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, enum: ['percent', 'fixed'], required: true },
    value: { type: Number, required: true, min: 1 },
    minSubtotal: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    usageLimit: { type: Number, default: null },
    usedCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);
CouponSchema.index({ code: 1 }, { unique: true });
export const Coupon = defineModel<CouponDoc>('Coupon', CouponSchema);

/* ---------------------------- Settings ---------------------------- */

export interface BannerDoc {
  _id: Types.ObjectId;
  title: Localized;
  subtitle: Localized;
  image: ImageRef | null;
  link: string;
  placement: 'hero' | 'promo';
  active: boolean;
  sortOrder: number;
}

export interface SettingsDoc {
  _id: Types.ObjectId;
  key: 'store';
  vatRatePercent: number;
  shipping: { yerevanFee: number; otherFee: number; freeThreshold: number };
  reservationTtlMinutes: number;
  banners: Types.DocumentArray<BannerDoc>;
  store: { phone: string; email: string; address: Localized; hours: Localized };
  updatedAt: Date;
  createdAt: Date;
}

const BannerSchema = new Schema<BannerDoc>({
  title: { type: LocalizedSchema, required: true },
  subtitle: { type: LocalizedSchema, default: () => ({ hy: '', ru: '', en: '' }) },
  image: { type: ImageSchema, default: null },
  link: { type: String, default: '/shop' },
  placement: { type: String, enum: ['hero', 'promo'], default: 'promo' },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
});

const SettingsSchema = new Schema<SettingsDoc>(
  {
    key: { type: String, required: true, default: 'store' },
    vatRatePercent: { type: Number, default: 20, min: 0, max: 50 },
    shipping: {
      yerevanFee: { type: Number, default: 1000, min: 0 },
      otherFee: { type: Number, default: 2000, min: 0 },
      freeThreshold: { type: Number, default: 20000, min: 0 },
    },
    reservationTtlMinutes: { type: Number, default: 30, min: 5, max: 1440 },
    banners: { type: [BannerSchema], default: [] },
    store: {
      phone: { type: String, default: '+374 10 000 000' },
      email: { type: String, default: 'hello@vapehub.am' },
      address: { type: LocalizedSchema, default: () => ({ hy: 'Երևան, Հայաստան', ru: 'Ереван, Армения', en: 'Yerevan, Armenia' }) },
      hours: { type: LocalizedSchema, default: () => ({ hy: '10:00 – 21:00', ru: '10:00 – 21:00', en: '10:00 – 21:00' }) },
    },
  },
  { timestamps: true },
);
SettingsSchema.index({ key: 1 }, { unique: true });
export const Settings = defineModel<SettingsDoc>('Settings', SettingsSchema);

/* ---------------------------- Orders ---------------------------- */

export const ORDER_STATUSES = [
  'pending',
  'awaiting_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'payment_failed',
  'expired',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'created',
  'pending',
  'requires_action',
  'succeeded',
  'failed',
  'cancelled',
  'expired',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentMethod = 'cod' | 'idram' | 'arca' | 'mock';

export interface OrderItemSnapshot {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  slug: string;
  name: Localized;
  variantLabel: Localized;
  sku: string;
  attributes: Record<string, string | number | null>;
  image: ImageRef | null;
  quantity: number;
  unitPrice: number;
  regularUnitPrice: number;
  lineTotal: number;
}

export interface OrderDoc {
  _id: Types.ObjectId;
  number: string;
  userId: Types.ObjectId | null;
  sessionHash: string | null;
  idempotencyScope: string;
  idempotencyKey: string;
  requestHash: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  locale: Locale;
  currency: 'AMD';
  items: OrderItemSnapshot[];
  totals: {
    subtotal: number;
    discount: number;
    shipping: number;
    vatRatePercent: number;
    vatAmount: number;
    total: number;
  };
  coupon: { code: string; type: 'percent' | 'fixed'; value: number } | null;
  pricing: { freeShippingThreshold: number; shippingRule: string; vatRounding: string; computedAt: Date };
  customer: { firstName: string; lastName: string; email: string; phone: string };
  shipping: { region: string; city: string; line1: string; line2: string; notes: string };
  ageConfirmed: boolean;
  termsAcceptedAt: Date;
  reservationExpiresAt: Date | null;
  timeline: { status: OrderStatus; at: Date; note?: string; actor?: string }[];
  reconciliation: { required: boolean; reason: string | null; flaggedAt: Date | null };
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<OrderItemSnapshot>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    slug: { type: String, required: true },
    name: { type: LocalizedSchema, required: true },
    variantLabel: { type: LocalizedSchema, required: true },
    sku: { type: String, required: true },
    attributes: { type: Schema.Types.Mixed, default: {} },
    image: { type: ImageSchema, default: null },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    regularUnitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { _id: false },
);

const OrderSchema = new Schema<OrderDoc>(
  {
    number: { type: String, required: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, default: null, immutable: true },
    sessionHash: { type: String, default: null },
    idempotencyScope: { type: String, required: true, immutable: true },
    idempotencyKey: { type: String, required: true, immutable: true },
    requestHash: { type: String, required: true, immutable: true },
    status: { type: String, enum: ORDER_STATUSES, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, required: true },
    paymentMethod: { type: String, enum: ['cod', 'idram', 'arca', 'mock'], required: true, immutable: true },
    locale: { type: String, enum: ['hy', 'ru', 'en'], default: 'hy' },
    currency: { type: String, enum: ['AMD'], default: 'AMD', immutable: true },
    items: { type: [OrderItemSchema], required: true, immutable: true },
    totals: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, required: true },
      shipping: { type: Number, required: true },
      vatRatePercent: { type: Number, required: true },
      vatAmount: { type: Number, required: true },
      total: { type: Number, required: true },
    },
    coupon: { type: new Schema({ code: String, type: String, value: Number }, { _id: false }), default: null },
    pricing: {
      freeShippingThreshold: Number,
      shippingRule: String,
      vatRounding: String,
      computedAt: Date,
    },
    customer: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    shipping: {
      region: { type: String, required: true },
      city: { type: String, required: true },
      line1: { type: String, required: true },
      line2: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
    ageConfirmed: { type: Boolean, required: true },
    termsAcceptedAt: { type: Date, required: true },
    reservationExpiresAt: { type: Date, default: null },
    timeline: [
      new Schema({ status: String, at: Date, note: String, actor: String }, { _id: false }),
    ],
    reconciliation: {
      required: { type: Boolean, default: false },
      reason: { type: String, default: null },
      flaggedAt: { type: Date, default: null },
    },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
OrderSchema.index({ number: 1 }, { unique: true });
// Idempotent checkout: one order per (owner scope, idempotency key).
OrderSchema.index({ idempotencyScope: 1, idempotencyKey: 1 }, { unique: true });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ sessionHash: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ 'reconciliation.required': 1 });
export const Order = defineModel<OrderDoc>('Order', OrderSchema);

/* -------------------------- Reservations -------------------------- */

export type ReservationStatus = 'active' | 'consumed' | 'released' | 'expired';

export interface ReservationDoc {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  releasedAt: Date | null;
  consumedAt: Date | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<ReservationDoc>(
  {
    orderId: { type: Schema.Types.ObjectId, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['active', 'consumed', 'released', 'expired'], required: true },
    expiresAt: { type: Date, required: true },
    releasedAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
    idempotencyKey: { type: String, required: true },
  },
  { timestamps: true },
);
// One reservation per order line (variant) — retries can never duplicate it.
ReservationSchema.index({ orderId: 1, variantId: 1 }, { unique: true });
// Expiry worker scans active reservations by expiry time.
ReservationSchema.index({ status: 1, expiresAt: 1 });
ReservationSchema.index({ sku: 1, status: 1 });
export const Reservation = defineModel<ReservationDoc>('Reservation', ReservationSchema);

/* ---------------------------- Payments ---------------------------- */

export interface PaymentTransactionDoc {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  orderNumber: string;
  provider: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: 'AMD';
  providerRef: string | null;
  attempt: number;
  /** Last redirect instructions returned by the provider (no secrets). */
  redirect: unknown;
  history: { status: PaymentStatus; at: Date; reason?: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<PaymentTransactionDoc>(
  {
    orderId: { type: Schema.Types.ObjectId, required: true },
    orderNumber: { type: String, required: true },
    provider: { type: String, enum: ['cod', 'idram', 'arca', 'mock'], required: true },
    status: { type: String, enum: PAYMENT_STATUSES, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ['AMD'], default: 'AMD' },
    providerRef: { type: String, default: null },
    attempt: { type: Number, default: 1 },
    redirect: { type: Schema.Types.Mixed, default: null },
    history: [new Schema({ status: String, at: Date, reason: String }, { _id: false })],
  },
  { timestamps: true },
);
PaymentTransactionSchema.index({ orderId: 1, attempt: 1 }, { unique: true });
PaymentTransactionSchema.index({ provider: 1, providerRef: 1 }, { unique: true, partialFilterExpression: { providerRef: { $type: 'string' } } });
PaymentTransactionSchema.index({ orderNumber: 1 });
export const PaymentTransaction = defineModel<PaymentTransactionDoc>('PaymentTransaction', PaymentTransactionSchema);

export interface PaymentEventDoc {
  _id: Types.ObjectId;
  provider: PaymentMethod;
  eventKey: string;
  paymentId: Types.ObjectId | null;
  orderNumber: string | null;
  type: string;
  verified: boolean;
  outcome: string;
  summary: Record<string, string | number | boolean | null>;
  receivedAt: Date;
}

const PaymentEventSchema = new Schema<PaymentEventDoc>({
  provider: { type: String, required: true },
  eventKey: { type: String, required: true },
  paymentId: { type: Schema.Types.ObjectId, default: null },
  orderNumber: { type: String, default: null },
  type: { type: String, required: true },
  verified: { type: Boolean, required: true },
  outcome: { type: String, required: true },
  summary: { type: Schema.Types.Mixed, default: {} },
  receivedAt: { type: Date, default: () => new Date() },
});
// Duplicate callback deliveries collapse onto one event record.
PaymentEventSchema.index({ provider: 1, eventKey: 1 }, { unique: true });
PaymentEventSchema.index({ paymentId: 1, receivedAt: -1 });
export const PaymentEvent = defineModel<PaymentEventDoc>('PaymentEvent', PaymentEventSchema);
