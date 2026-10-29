/**
 * Data-transfer types shared by Route Handlers (src/app/api/v1), server services
 * (src/server) and UI code. Contract: docs/api-contract.md.
 * Money is always an integer amount of AMD.
 */

export const LOCALES = ["hy", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "hy";

export type Localized = Record<Locale, string>;

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "MFA_REQUIRED"
  | "CSRF_INVALID"
  | "ORIGIN_NOT_ALLOWED"
  | "AGE_CONFIRMATION_REQUIRED"
  | "NOT_FOUND"
  | "OUT_OF_STOCK"
  | "CART_EMPTY"
  | "INVALID_TRANSITION"
  | "CONFLICT"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "VALIDATION_FAILED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "SERVICE_UNAVAILABLE"
  | "PAYMENT_PROVIDER_UNAVAILABLE"
  | "UPLOADS_NOT_CONFIGURED";

export interface ApiErrorDetail {
  path?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; details?: ApiErrorDetail[] | Record<string, unknown>; requestId?: string };
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Image {
  url: string;
  alt: string;
  width: number;
  height: number;
}

/* ------------------------------------------------------------- catalog */

export const SORT_OPTIONS = ["newest", "price-asc", "price-desc", "popularity"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface ProductQuery {
  page?: number;
  pageSize?: number;
  sort?: SortOption;
  q?: string;
  category?: string[];
  brand?: string[];
  flavor?: string[];
  nicotine?: number[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
}

export interface TaxonomyRef {
  slug: string;
  name: string;
}

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  brand: TaxonomyRef | null;
  category: TaxonomyRef | null;
  image: Image | null;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
  isNew: boolean;
  featured: boolean;
  /** Variant used by quick "add to cart" when the product has exactly one purchasable variant. */
  defaultVariantId: string | null;
  variantCount: number;
}

export interface VariantAttributes {
  flavor?: string | null;
  nicotineMg?: number | null;
  volumeMl?: number | null;
  color?: string | null;
  resistanceOhm?: number | null;
}

export interface Variant {
  id: string;
  sku: string;
  label: string;
  attributes: VariantAttributes;
  price: number;
  compareAtPrice: number | null;
  available: number;
  images: Image[];
}

export interface ProductDetail extends ProductCard {
  description: string;
  tags: string[];
  images: Image[];
  warnings: string[];
  variants: Variant[];
  seo: { title: string; description: string };
  related: ProductCard[];
}

export interface FacetCount {
  slug: string;
  name: string;
  count: number;
}

export interface Facets {
  categories: FacetCount[];
  brands: FacetCount[];
  flavors: { value: string; label: string; count: number }[];
  nicotine: { value: number; count: number }[];
  price: { min: number; max: number };
}

export interface SearchSuggestion {
  slug: string;
  name: string;
  image: Image | null;
  price: number;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  image: Image | null;
  productCount: number;
}

export interface Brand {
  slug: string;
  name: string;
  logo: Image | null;
}

/* ---------------------------------------------------------------- cart */

export type CartLineStatus = "ok" | "price_changed" | "insufficient_stock" | "out_of_stock" | "unavailable";

export interface CartLine {
  id: string;
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  variantLabel: string;
  sku: string;
  image: Image | null;
  unitPrice: number;
  compareAtPrice: number | null;
  previousUnitPrice: number | null;
  quantity: number;
  lineTotal: number;
  available: number;
  status: CartLineStatus;
}

export interface Totals {
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  shippingRegion: string;
  shippingEstimated: boolean;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
  vatRatePercent: number;
  vatAmount: number;
  total: number;
}

export interface Cart {
  id: string | null;
  items: CartLine[];
  totals: Totals;
  coupon: { code: string; valid: boolean; reason?: string } | null;
  issues: { itemId: string; type: CartLineStatus }[];
}

/* -------------------------------------------------------------- orders */

export const ORDER_STATUSES = [
  "pending",
  "awaiting_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "payment_failed",
  "expired",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "created",
  "pending",
  "requires_action",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentMethod = "cod" | "idram" | "arca" | "mock";

export interface CheckoutRequest {
  customer: { firstName: string; lastName: string; email: string; phone: string };
  shipping: { region: string; city: string; line1: string; line2?: string; notes?: string };
  paymentMethod: PaymentMethod;
  couponCode?: string;
  ageConfirmed: true;
  termsAccepted: true;
  locale: Locale;
  saveAddress?: boolean;
}

export interface PaymentRedirect {
  url: string;
  method: "GET" | "POST";
  fields: Record<string, string>;
}

export interface OrderSummary {
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
  total: number;
  itemCount: number;
  reservationExpiresAt: string | null;
}

export interface OrderDetail extends OrderSummary {
  items: { name: string; sku: string; variantLabel: string; quantity: number; unitPrice: number; lineTotal: number; image: Image | null }[];
  totals: { subtotal: number; discount: number; shipping: number; vatRatePercent: number; vatAmount: number; total: number };
  customer: { firstName: string; lastName: string; email: string; phone: string };
  shipping: { region: string; city: string; line1: string; line2: string; notes: string };
  timeline: { status: OrderStatus; at: string; note?: string }[];
  canCancel: boolean;
}

export interface CheckoutResponse {
  order: OrderSummary;
  payment: { method: PaymentMethod; status: PaymentStatus; redirect: PaymentRedirect | null };
}

export interface PaymentStatusResponse {
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  method: PaymentMethod;
  amount: number;
  reservationExpiresAt: string | null;
  redirect: PaymentRedirect | null;
}

/* ---------------------------------------------------------------- auth */

export type Role = "customer" | "admin";
export type MfaState = "none" | "verify" | "enroll";

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  locale: Locale;
  role: Role;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface MeResponse {
  user: User | null;
  session: { mfa: MfaState; ageConfirmed: boolean };
}

export interface LoginResponse {
  user: User;
  csrfToken: string;
  mfa: MfaState;
}

export interface SessionInfo {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string;
}

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  region: string;
  city: string;
  line1: string;
  line2: string;
  notes: string;
  isDefault: boolean;
}

/* ------------------------------------------------------------- content */

export interface BlogCard {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: Image | null;
  category: string;
  readMinutes: number;
  publishedAt: string;
}

export interface BlogPost extends BlogCard {
  body: string;
  tags: string[];
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image: Image | null;
  link: string;
  placement: "hero" | "promo";
}

export interface Region {
  code: string;
  name: string;
}

export interface PublicSettings {
  vatRatePercent: number;
  shipping: { yerevanFee: number; otherFee: number; freeThreshold: number };
  regions: Region[];
  banners: Banner[];
  store: { phone: string; email: string; address: string; hours: string };
  paymentMethods: { method: PaymentMethod; enabled: boolean }[];
}

/* --------------------------------------------------------------- admin
 * Admin endpoints return full localized objects ({ hy, ru, en }).
 * (Added by the server layer; contract: docs/api-contract.md §11.)
 */

export interface AdminImage {
  url: string;
  publicId: string | null;
  alt: Localized;
  width: number;
  height: number;
}

export interface AdminVariant {
  id: string;
  sku: string;
  attributes: VariantAttributes;
  label: Localized;
  price: number;
  salePrice: number | null;
  stock: number;
  images: AdminImage[];
  active: boolean;
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: Localized;
  shortDescription: Localized;
  description: Localized;
  brandId: string | null;
  categoryId: string | null;
  tags: string[];
  images: AdminImage[];
  variants: AdminVariant[];
  status: "active" | "draft" | "archived";
  featured: boolean;
  salesCount: number;
  minPrice: number;
  warnings: Localized[];
  seo: { title: Localized; description: Localized };
  createdAt: string;
  updatedAt: string;
}

export interface AdminCategory {
  id: string;
  slug: string;
  name: Localized;
  description: Localized;
  image: AdminImage | null;
  sortOrder: number;
  active: boolean;
}

export interface AdminBrand {
  id: string;
  slug: string;
  name: string;
  logo: AdminImage | null;
  sortOrder: number;
  active: boolean;
}

export interface AdminOrderRow extends OrderSummary {
  id: string;
  customerName: string;
  customerEmail: string;
  reconciliationRequired: boolean;
}

export interface AdminOrderDetail extends OrderDetail {
  id: string;
  reconciliation: { required: boolean; reason: string | null };
  payments: { id: string; provider: PaymentMethod; status: PaymentStatus; amount: number; providerRef: string | null; createdAt: string }[];
  allowedTransitions: OrderStatus[];
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  orderCount: number;
}

export interface AdminDashboard {
  ordersToday: number;
  ordersTotal: number;
  revenuePaid: number;
  pendingOrders: number;
  awaitingPayment: number;
  reconciliationRequired: number;
  customers: number;
  lowStock: { productId: string; productName: string; variantId: string; sku: string; stock: number }[];
  recentOrders: AdminOrderRow[];
}

export interface InventoryMovementRow {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  delta: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  kind: string;
  actorId: string | null;
  createdAt: string;
}

export interface AdminBlogPost {
  id: string;
  slug: string;
  title: Localized;
  excerpt: Localized;
  body: Localized;
  coverImage: AdminImage | null;
  category: string;
  tags: string[];
  readMinutes: number;
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string;
}

export interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  locale: string;
  status: "new" | "read" | "archived";
  createdAt: string;
}

export interface AdminCoupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
}

export interface AdminBanner {
  id: string;
  title: Localized;
  subtitle: Localized;
  image: AdminImage | null;
  link: string;
  placement: "hero" | "promo";
  active: boolean;
  sortOrder: number;
}

export interface AdminSettings {
  vatRatePercent: number;
  shipping: { yerevanFee: number; otherFee: number; freeThreshold: number };
  reservationTtlMinutes: number;
  banners: AdminBanner[];
  store: { phone: string; email: string; address: Localized; hours: Localized };
}

export interface AuditLogRow {
  id: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  changes: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface MediaRow {
  id: string;
  publicId: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  createdAt: string;
}

export interface PaymentProviderStatus {
  method: PaymentMethod;
  enabled: boolean;
  configured: boolean;
  mode: "live" | "mock" | "disabled";
  note: string;
}

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographerUrl: string;
  pexelsUrl: string;
  src: { medium: string; large: string };
}

export interface MfaSetupResponse {
  otpauthUrl: string;
  qrDataUrl: string;
  secret: string;
}
