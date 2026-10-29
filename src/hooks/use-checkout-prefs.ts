"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const KEY = "vh_checkout_prefs";
const EVENT = "vh:checkout-prefs";

interface Prefs {
  region?: string;
  coupon?: string;
}

function readRaw(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Region and coupon chosen on the cart page, carried to checkout (per tab session).
 * Backed by sessionStorage through useSyncExternalStore: server render sees no prefs,
 * the client hydrates without mismatches, and every component stays in sync.
 */
export function useCheckoutPrefs() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "{}");
  const prefs = useMemo<Prefs>(() => {
    try {
      return JSON.parse(raw) as Prefs;
    } catch {
      return {};
    }
  }, [raw]);

  const update = useCallback((patch: Prefs) => {
    let current: Prefs = {};
    try {
      current = JSON.parse(readRaw()) as Prefs;
    } catch {
      current = {};
    }
    const next = { ...current, ...patch };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage unavailable (private mode): the choice simply is not remembered
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { prefs, update };
}
