"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useCallback, useState } from "react";
import { api } from "@/lib/api/client";
import type { Cart, Locale } from "@/lib/api/types";

export const cartKey = (locale: string) => ["cart", locale] as const;

export function useCart() {
  const locale = useLocale() as Locale;
  return useQuery({
    queryKey: cartKey(locale),
    queryFn: ({ signal }) => api<Cart>("/cart", { query: { locale }, signal }),
    staleTime: 15_000,
  });
}

/** Server-computed totals for a delivery region and optional coupon. */
export function useCartQuote(region: string | undefined, coupon: string | undefined, enabled = true) {
  const locale = useLocale() as Locale;
  return useQuery({
    queryKey: ["cart", locale, "quote", region ?? "", coupon ?? ""],
    queryFn: ({ signal }) => api<Cart>("/cart", { query: { locale, region, coupon }, signal }),
    enabled,
    staleTime: 10_000,
    placeholderData: (previous) => previous,
  });
}

/**
 * Cart mutations. Each line tracks its own pending state so concurrent edits to
 * different lines stay independent, while a second edit to the same line waits.
 */
export function useCartMutations() {
  const client = useQueryClient();
  const locale = useLocale() as Locale;
  const [pendingLines, setPendingLines] = useState<ReadonlySet<string>>(new Set());

  const setPending = useCallback((id: string, on: boolean) => {
    setPendingLines((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const store = useCallback(
    (cart: Cart) => {
      client.setQueryData(cartKey(locale), cart);
      // Region/coupon quotes depend on the lines that just changed.
      void client.invalidateQueries({ predicate: (q) => q.queryKey[0] === "cart" && q.queryKey[2] === "quote" });
    },
    [client, locale],
  );

  const add = useMutation({
    mutationFn: (input: { productId: string; variantId: string; quantity: number }) =>
      api<Cart>("/cart/items", { method: "POST", body: input, query: { locale } }),
    onSuccess: store,
  });

  const update = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      api<Cart>(`/cart/items/${encodeURIComponent(itemId)}`, { method: "PATCH", body: { quantity }, query: { locale } }),
    onMutate: ({ itemId }) => setPending(itemId, true),
    onSuccess: store,
    onSettled: (_data, _err, { itemId }) => setPending(itemId, false),
  });

  const remove = useMutation({
    mutationFn: ({ itemId }: { itemId: string }) =>
      api<Cart>(`/cart/items/${encodeURIComponent(itemId)}`, { method: "DELETE", query: { locale } }),
    onMutate: ({ itemId }) => setPending(itemId, true),
    onSuccess: store,
    onSettled: (_data, _err, { itemId }) => setPending(itemId, false),
  });

  const clear = useMutation({
    mutationFn: () => api<Cart>("/cart", { method: "DELETE", query: { locale } }),
    onSuccess: store,
  });

  const refresh = useCallback(() => client.invalidateQueries({ queryKey: cartKey(locale) }), [client, locale]);

  return { add, update, remove, clear, refresh, pendingLines };
}
