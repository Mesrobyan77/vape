import type { HydratedDocument } from "mongoose";
import type { Locale, PaymentMethod, PublicSettings } from "@/lib/api/types";
import { REGION_CODES, REGION_NAMES, type PricingSettings } from "@/lib/pricing";
import { connectDb } from "../db";
import { tr } from "../i18n";
import { Settings, type SettingsDoc } from "../models";
import { imageDto } from "./dto";
import { paymentMethodAvailability } from "../payments/registry";

export async function getSettings(): Promise<HydratedDocument<SettingsDoc>> {
  await connectDb();
  const doc = await Settings.findOneAndUpdate({ key: "store" }, { $setOnInsert: { key: "store" } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return doc;
}

export function pricingSettingsOf(s: Pick<SettingsDoc, "vatRatePercent" | "shipping">): PricingSettings {
  return {
    vatRatePercent: s.vatRatePercent,
    shipping: { yerevanFee: s.shipping.yerevanFee, otherFee: s.shipping.otherFee, freeThreshold: s.shipping.freeThreshold },
  };
}

export async function publicSettings(locale: Locale): Promise<PublicSettings> {
  const s = await getSettings();
  const methods: PaymentMethod[] = ["cod", "idram", "arca", "mock"];
  return {
    vatRatePercent: s.vatRatePercent,
    shipping: { yerevanFee: s.shipping.yerevanFee, otherFee: s.shipping.otherFee, freeThreshold: s.shipping.freeThreshold },
    regions: REGION_CODES.map((code) => ({ code, name: REGION_NAMES[code][locale] })),
    banners: s.banners
      .filter((b) => b.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((b) => ({
        id: String(b._id),
        title: tr(b.title, locale),
        subtitle: tr(b.subtitle, locale),
        image: imageDto(b.image, locale),
        link: b.link,
        placement: b.placement,
      })),
    store: {
      phone: s.store.phone,
      email: s.store.email,
      address: tr(s.store.address, locale),
      hours: tr(s.store.hours, locale),
    },
    paymentMethods: methods
      .map((method) => ({ method, enabled: paymentMethodAvailability(method) }))
      .filter((m) => m.method !== "mock" || m.enabled),
  };
}
