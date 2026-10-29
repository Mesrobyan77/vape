import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../../messages/${locale}.json`)).default;
  // Armenian is the source of truth: any key missing in ru/en falls back to hy instead of
  // ever rendering a raw key.
  const fallback = locale === "hy" ? messages : (await import("../../messages/hy.json")).default;
  return {
    locale,
    messages: deepMerge(fallback, messages),
    timeZone: "Asia/Yerevan",
    getMessageFallback: ({ key, namespace }) => {
      const path = [namespace, key].filter(Boolean).join(".");
      return lookup(fallback, path) ?? "";
    },
  };
});

type Tree = { [key: string]: string | Tree };

function deepMerge(base: Tree, override: Tree): Tree {
  const out: Tree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] = typeof value === "object" && typeof current === "object" ? deepMerge(current, value) : value;
  }
  return out;
}

function lookup(tree: Tree, path: string): string | undefined {
  let node: string | Tree | undefined = tree;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}
