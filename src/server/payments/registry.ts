import type { PaymentMethod } from "@/lib/api/types";
import { arcaProvider } from "./arca";
import { idramProvider } from "./idram";
import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export const codProvider: PaymentProvider = {
  method: "cod",
  online: false,
  isEnabled: () => true,
  async initiate() {
    return { redirect: null, providerRef: null };
  },
};

const PROVIDERS: Record<PaymentMethod, PaymentProvider> = {
  cod: codProvider,
  idram: idramProvider,
  arca: arcaProvider,
  mock: mockProvider,
};

export const providerFor = (method: PaymentMethod): PaymentProvider => PROVIDERS[method];
export const paymentMethodAvailability = (method: PaymentMethod): boolean => PROVIDERS[method].isEnabled();
