/**
 * Pure pricing rules (no server imports — safe for UI and server).
 * All amounts are VAT-inclusive whole AMD.
 *
 *  1. merchandise subtotal = Σ unitPrice × quantity (unitPrice already sale-aware)
 *  2. discount from a valid coupon, applied to the merchandise subtotal, never above it
 *  3. free shipping when (subtotal − discount) ≥ freeThreshold; otherwise the regional fee
 *  4. total = subtotal − discount + shipping
 *  5. VAT portion contained in the total = round_half_up(total × rate / (100 + rate))
 */

export const REGION_CODES = [
  "yerevan",
  "aragatsotn",
  "ararat",
  "armavir",
  "gegharkunik",
  "kotayk",
  "lori",
  "shirak",
  "syunik",
  "tavush",
  "vayots-dzor",
] as const;
export type RegionCode = (typeof REGION_CODES)[number];

export const REGION_NAMES: Record<RegionCode, { hy: string; ru: string; en: string }> = {
  yerevan: { hy: "Երևան", ru: "Ереван", en: "Yerevan" },
  aragatsotn: { hy: "Արագածոտն", ru: "Арагацотн", en: "Aragatsotn" },
  ararat: { hy: "Արարատ", ru: "Арарат", en: "Ararat" },
  armavir: { hy: "Արմավիր", ru: "Армавир", en: "Armavir" },
  gegharkunik: { hy: "Գեղարքունիք", ru: "Гегаркуник", en: "Gegharkunik" },
  kotayk: { hy: "Կոտայք", ru: "Котайк", en: "Kotayk" },
  lori: { hy: "Լոռի", ru: "Лори", en: "Lori" },
  shirak: { hy: "Շիրակ", ru: "Ширак", en: "Shirak" },
  syunik: { hy: "Սյունիք", ru: "Сюник", en: "Syunik" },
  tavush: { hy: "Տավուշ", ru: "Тавуш", en: "Tavush" },
  "vayots-dzor": { hy: "Վայոց Ձոր", ru: "Вайоц Дзор", en: "Vayots Dzor" },
};

export const isRegionCode = (value: string): value is RegionCode => (REGION_CODES as readonly string[]).includes(value);

export interface ShippingSettings {
  yerevanFee: number;
  otherFee: number;
  freeThreshold: number;
}

export interface PricingSettings {
  vatRatePercent: number;
  shipping: ShippingSettings;
}

export const DEFAULT_PRICING: PricingSettings = {
  vatRatePercent: 20,
  shipping: { yerevanFee: 1000, otherFee: 2000, freeThreshold: 20000 },
};

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

export interface CouponRule {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
}

export type CouponRejection = "not_found" | "inactive" | "not_started" | "expired" | "usage_limit" | "min_subtotal";

export function assertWholeAmd(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative integer AMD amount`);
}

/** Half-up rounding to whole dram (non-negative inputs). */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

export function merchandiseSubtotal(lines: PricedLine[]): number {
  return lines.reduce((sum, line) => {
    assertWholeAmd(line.unitPrice, "unitPrice");
    if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new RangeError("quantity must be a positive integer");
    return sum + line.unitPrice * line.quantity;
  }, 0);
}

export function evaluateCoupon(
  coupon: CouponRule | null,
  subtotal: number,
  now: Date = new Date(),
): { ok: true; discount: number } | { ok: false; reason: CouponRejection } {
  if (!coupon) return { ok: false, reason: "not_found" };
  if (!coupon.active) return { ok: false, reason: "inactive" };
  if (coupon.startsAt && now < coupon.startsAt) return { ok: false, reason: "not_started" };
  if (coupon.endsAt && now > coupon.endsAt) return { ok: false, reason: "expired" };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return { ok: false, reason: "usage_limit" };
  if (subtotal < coupon.minSubtotal) return { ok: false, reason: "min_subtotal" };
  const raw = coupon.type === "percent" ? roundHalfUp((subtotal * Math.min(coupon.value, 100)) / 100) : coupon.value;
  return { ok: true, discount: Math.min(raw, subtotal) };
}

export function shippingFee(region: RegionCode, discountedSubtotal: number, settings: ShippingSettings): number {
  if (discountedSubtotal <= 0) return 0;
  if (discountedSubtotal >= settings.freeThreshold) return 0;
  return region === "yerevan" ? settings.yerevanFee : settings.otherFee;
}

/** VAT contained in a VAT-inclusive amount. 20 % → amount × 20 / 120. */
export function vatPortion(inclusiveAmount: number, ratePercent: number): number {
  assertWholeAmd(inclusiveAmount, "amount");
  if (ratePercent < 0 || ratePercent > 100) throw new RangeError("VAT rate out of range");
  if (ratePercent === 0) return 0;
  return roundHalfUp((inclusiveAmount * ratePercent) / (100 + ratePercent));
}

export interface ComputedTotals {
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  shippingRegion: RegionCode;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
  vatRatePercent: number;
  vatAmount: number;
  total: number;
}

export function computeTotals(lines: PricedLine[], region: RegionCode, settings: PricingSettings, discount = 0): ComputedTotals {
  const subtotal = merchandiseSubtotal(lines);
  assertWholeAmd(discount, "discount");
  const appliedDiscount = Math.min(discount, subtotal);
  const discounted = subtotal - appliedDiscount;
  const shipping = shippingFee(region, discounted, settings.shipping);
  const total = discounted + shipping;
  return {
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal,
    discount: appliedDiscount,
    shipping,
    shippingRegion: region,
    freeShippingThreshold: settings.shipping.freeThreshold,
    amountToFreeShipping: Math.max(0, settings.shipping.freeThreshold - discounted),
    vatRatePercent: settings.vatRatePercent,
    vatAmount: vatPortion(total, settings.vatRatePercent),
    total,
  };
}
