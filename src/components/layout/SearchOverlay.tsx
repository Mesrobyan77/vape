"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import type { Locale, SearchSuggestion } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { useDialog } from "@/hooks/use-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useUi } from "@/components/providers/UiState";
import { SearchIcon } from "@/components/icons";

export function SearchOverlay() {
  const { panel, close } = useUi();
  const open = panel === "search";
  return <AnimatePresence>{open ? <SearchDialog onClose={close} /> : null}</AnimatePresence>;
}

const MIN_CHARS = 2;

function SearchDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(-1);
  const debounced = useDebouncedValue(term.trim(), 250);
  const enabled = debounced.length >= MIN_CHARS;

  useDialog(dialogRef, true, onClose, { initialFocus: inputRef });

  const suggestions = useQuery({
    queryKey: ["suggest", locale, debounced],
    queryFn: ({ signal }) => api<SearchSuggestion[]>("/products/suggest", { query: { q: debounced, locale }, signal }),
    enabled,
    staleTime: 60_000,
    retry: false,
  });

  const [activeFor, setActiveFor] = useState(debounced);
  if (activeFor !== debounced) {
    setActiveFor(debounced);
    setActive(-1);
  }

  const items = enabled ? (suggestions.data ?? []) : [];
  const typing = term.trim() !== debounced;
  const loading = enabled && (suggestions.isFetching || typing);

  const go = (path: string) => {
    onClose();
    router.push(path);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = term.trim();
    if (active >= 0 && items[active]) {
      go(`/products/${items[active].slug}`);
      return;
    }
    if (q.length === 0) return;
    go(`/search?q=${encodeURIComponent(q)}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    }
  };

  let status: string | null = null;
  if (term.trim().length > 0 && term.trim().length < MIN_CHARS) status = t("minChars");
  else if (loading) status = t("loading");
  else if (enabled && suggestions.isError) status = t("error");
  else if (enabled && suggestions.isSuccess && items.length === 0) status = t("noResults", { q: debounced });

  return (
    <motion.div
      id="search-overlay"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      className="fixed inset-0 z-[9999] flex items-start justify-center px-4 pt-[18vh]"
      initial={{ clipPath: "circle(0% at 88% 50px)" }}
      animate={{ clipPath: "circle(150% at 88% 50px)" }}
      exit={{ clipPath: "circle(0% at 88% 50px)" }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0, 1] }}
      style={{ backgroundColor: "rgba(12,12,13,0.92)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="search-overlay"
    >
      <motion.div
        className="w-full max-w-[560px]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        <form role="search" onSubmit={submit} className="relative flex" aria-label={t("label")}>
          <label htmlFor="site-search" className="sr-only">
            {t("label")}
          </label>
          <input
            ref={inputRef}
            id="site-search"
            type="search"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={items.length > 0}
            aria-controls={listId}
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            maxLength={64}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("placeholder")}
            className="h-[66px] w-full bg-white pl-6 pr-28 text-[16px] text-[#3c3d44] outline-none placeholder:text-[#6c6e78] focus-visible:outline-2 focus-visible:outline-primary-2"
          />
          {term ? (
            <button
              type="button"
              className="absolute right-[70px] top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-[#3c3d44] hover:text-primary"
              onClick={() => {
                setTerm("");
                inputRef.current?.focus();
              }}
              aria-label={t("clear")}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
          <button
            type="submit"
            className="grid h-[66px] w-[66px] shrink-0 place-items-center bg-primary-2 text-black transition-colors hover:bg-primary hover:text-white"
            aria-label={t("submit")}
          >
            <SearchIcon className="h-6 w-6" />
          </button>
        </form>

        <div className="mt-3 rounded-[10px] bg-surface" aria-live="polite">
          {status ? (
            <p className="flex items-center gap-2 px-5 py-4 text-white" data-testid="search-status">
              {loading ? <span className="spinner" aria-hidden /> : null}
              {status}
              {enabled && suggestions.isError ? (
                <button type="button" className="text-link ml-auto" onClick={() => suggestions.refetch()}>
                  {tCommon("retry")}
                </button>
              ) : null}
            </p>
          ) : null}
          <ul id={listId} role="listbox" aria-label={t("suggestions")} className="max-h-[50vh] overflow-y-auto">
            {items.map((item, index) => (
              <li
                key={item.slug}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={`flex cursor-pointer items-center gap-4 px-5 py-3 text-white ${index === active ? "bg-primary" : "hover:bg-primary/40"}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(`/products/${item.slug}`)}
                onMouseEnter={() => setActive(index)}
              >
                <span className="thumb h-14 w-14">
                  {item.image ? (
                    <Image src={item.image.url} alt="" width={56} height={56} className="h-14 w-14 object-contain" />
                  ) : null}
                </span>
                <span className="flex-1 font-semibold">{item.name}</span>
                <span className="font-heading text-sm">{formatAmd(item.price)}</span>
              </li>
            ))}
          </ul>
          {items.length > 0 ? (
            <button
              type="button"
              className="w-full border-t border-white/10 px-5 py-3 text-left text-primary-2 hover:text-white"
              onClick={() => go(`/search?q=${encodeURIComponent(debounced)}`)}
            >
              {t("viewAll", { q: debounced })}
            </button>
          ) : null}
        </div>
      </motion.div>

      <button
        type="button"
        onClick={onClose}
        className="icon-btn absolute right-4 top-5"
        aria-label={t("close")}
        data-testid="close-search"
      >
        <X className="!h-8 !w-8" aria-hidden />
      </button>
    </motion.div>
  );
}
