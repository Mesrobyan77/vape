import { describe, expect, it } from "vitest";
import { formatAmd } from "@/lib/money";
import {
  DEFAULT_PRICING,
  computeTotals,
  evaluateCoupon,
  isRegionCode,
  merchandiseSubtotal,
  roundHalfUp,
  shippingFee,
  vatPortion,
  type CouponRule,
} from "@/lib/pricing";

const coupon = (over: Partial<CouponRule> = {}): CouponRule => ({
  code: "TEN",
  type: "percent",
  value: 10,
  minSubtotal: 0,
  active: true,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  usedCount: 0,
  ...over,
});

describe("formatAmd", () => {
  it.each([
    [0, "0 ֏"],
    [999, "999 ֏"],
    [1000, "1 000 ֏"],
    [12500, "12 500 ֏"],
    [1234567, "1 234 567 ֏"],
    [-2500, "-2 500 ֏"],
    [12499.6, "12 500 ֏"],
  ])("formats %d as %s", (input, expected) => {
    expect(formatAmd(input)).toBe(expected);
  });
  it("never prints decimals", () => {
    expect(formatAmd(19999.4)).not.toMatch(/[.,]\d/);
  });
  it("rejects non-finite input", () => {
    expect(() => formatAmd(Number.NaN)).toThrow(TypeError);
  });
});

describe("VAT portion (prices include VAT)", () => {
  it("uses amount × rate / (100 + rate), not amount × rate", () => {
    expect(vatPortion(12000, 20)).toBe(2000);
    expect(vatPortion(12000, 20)).not.toBe(2400);
  });
  it("rounds half up to whole dram", () => {
    expect(vatPortion(1003, 20)).toBe(167); // 167.1666
    expect(vatPortion(1005, 20)).toBe(168); // 167.5 → 168
    expect(vatPortion(1, 20)).toBe(0);
    expect(vatPortion(3, 20)).toBe(1); // 0.5 → 1
  });
  it("supports a zero and a configurable rate", () => {
    expect(vatPortion(5000, 0)).toBe(0);
    expect(vatPortion(11000, 10)).toBe(1000);
  });
  it("rejects fractional amounts and invalid rates", () => {
    expect(() => vatPortion(10.5, 20)).toThrow(RangeError);
    expect(() => vatPortion(100, 101)).toThrow(RangeError);
    expect(() => vatPortion(-1, 20)).toThrow(RangeError);
  });
  it("roundHalfUp", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(2.4999)).toBe(2);
  });
});

describe("shipping", () => {
  const s = DEFAULT_PRICING.shipping;
  it("charges 1 000 ֏ in Yerevan and 2 000 ֏ elsewhere", () => {
    expect(shippingFee("yerevan", 5000, s)).toBe(1000);
    expect(shippingFee("shirak", 5000, s)).toBe(2000);
  });
  it("is free at exactly the threshold and above", () => {
    expect(shippingFee("yerevan", 19999, s)).toBe(1000);
    expect(shippingFee("yerevan", 20000, s)).toBe(0);
    expect(shippingFee("lori", 20001, s)).toBe(0);
  });
  it("is zero for an empty cart", () => {
    expect(shippingFee("lori", 0, s)).toBe(0);
  });
  it("validates region codes", () => {
    expect(isRegionCode("yerevan")).toBe(true);
    expect(isRegionCode("moscow")).toBe(false);
  });
});

describe("coupons", () => {
  it("applies a percentage of the subtotal (half-up)", () => {
    expect(evaluateCoupon(coupon(), 12345)).toEqual({ ok: true, discount: 1235 });
  });
  it("caps fixed discounts at the subtotal", () => {
    expect(evaluateCoupon(coupon({ type: "fixed", value: 99999 }), 5000)).toEqual({ ok: true, discount: 5000 });
  });
  it.each([
    [null, "not_found"],
    [coupon({ active: false }), "inactive"],
    [coupon({ startsAt: new Date(Date.now() + 86_400_000) }), "not_started"],
    [coupon({ endsAt: new Date(Date.now() - 1000) }), "expired"],
    [coupon({ usageLimit: 3, usedCount: 3 }), "usage_limit"],
    [coupon({ minSubtotal: 10000 }), "min_subtotal"],
  ])("rejects %#", (c, reason) => {
    expect(evaluateCoupon(c, 5000)).toEqual({ ok: false, reason });
  });
});

describe("computeTotals", () => {
  it("computes a typical Yerevan order", () => {
    const t = computeTotals([{ unitPrice: 4900, quantity: 2 }], "yerevan", DEFAULT_PRICING);
    expect(t).toMatchObject({ subtotal: 9800, discount: 0, shipping: 1000, total: 10800, vatAmount: 1800, itemCount: 2, amountToFreeShipping: 10200 });
  });
  it("applies the free-shipping threshold AFTER discounts", () => {
    const lines = [{ unitPrice: 21000, quantity: 1 }];
    expect(computeTotals(lines, "ararat", DEFAULT_PRICING, 0).shipping).toBe(0);
    const discounted = computeTotals(lines, "ararat", DEFAULT_PRICING, 2100);
    expect(discounted.shipping).toBe(2000);
    expect(discounted.total).toBe(21000 - 2100 + 2000);
  });
  it("never lets the discount exceed the subtotal", () => {
    const t = computeTotals([{ unitPrice: 1000, quantity: 1 }], "yerevan", DEFAULT_PRICING, 5000);
    expect(t.discount).toBe(1000);
    expect(t.total).toBe(0);
  });
  it("VAT is taken from the VAT-inclusive grand total", () => {
    const t = computeTotals([{ unitPrice: 9999, quantity: 1 }], "kotayk", DEFAULT_PRICING);
    expect(t.total).toBe(11999);
    expect(t.vatAmount).toBe(Math.floor((11999 * 20) / 120 + 0.5));
  });
  it("rejects invalid line data", () => {
    expect(() => merchandiseSubtotal([{ unitPrice: 10.5, quantity: 1 }])).toThrow();
    expect(() => merchandiseSubtotal([{ unitPrice: 10, quantity: 0 }])).toThrow();
  });
});
