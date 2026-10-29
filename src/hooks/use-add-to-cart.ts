"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError } from "@/lib/api/client";
import { useCartMutations } from "./use-cart";
import { useErrorMessage } from "./use-error-message";
import { useToast } from "@/components/providers/Toaster";
import { useUi } from "@/components/providers/UiState";
import { requestAgeConfirmation } from "@/components/compliance/AgeGate";

export type AddState = "idle" | "loading" | "success" | "error";

/**
 * Add-to-cart with explicit states. Duplicate clicks are ignored while a request is in
 * flight; success is only shown after the server confirms; the drawer opens like the
 * reference's mini cart.
 */
export function useAddToCart(options: { openDrawer?: boolean } = {}) {
  const { openDrawer = true } = options;
  const t = useTranslations("product");
  const { add } = useCartMutations();
  const toast = useToast();
  const ui = useUi();
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<AddState>("idle");
  const inflight = useRef(false);
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const addToCart = useCallback(
    async (input: { productId: string; variantId: string; quantity: number; name: string }) => {
      if (inflight.current) return false;
      inflight.current = true;
      setState("loading");
      window.clearTimeout(resetTimer.current);
      try {
        await add.mutateAsync({ productId: input.productId, variantId: input.variantId, quantity: input.quantity });
        setState("success");
        toast.success(t("addedToast", { name: input.name }));
        if (openDrawer) ui.open("cart");
        resetTimer.current = window.setTimeout(() => setState("idle"), 1800);
        return true;
      } catch (err) {
        setState("error");
        if (isApiError(err) && err.code === "AGE_CONFIRMATION_REQUIRED") {
          requestAgeConfirmation();
        } else if (isApiError(err) && err.code === "OUT_OF_STOCK") {
          const available = Array.isArray(err.details) ? Number(err.details[0]?.available ?? 0) : 0;
          toast.error(available > 0 ? t("stockConflict", { available }) : t("outOfStock"));
        } else {
          toast.error(`${t("addError")} ${errorMessage(err)}`);
        }
        resetTimer.current = window.setTimeout(() => setState("idle"), 2500);
        return false;
      } finally {
        inflight.current = false;
      }
    },
    [add, toast, t, ui, openDrawer, errorMessage],
  );

  return { addToCart, state };
}
