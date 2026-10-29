"use client";

import { Minus, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import type { Facets, ProductQuery } from "@/lib/api/types";
import { toggleValue } from "@/lib/catalog-query";
import { formatAmd } from "@/lib/money";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SearchIcon } from "@/components/icons";

interface PanelProps {
  facets: Facets | null;
  query: ProductQuery;
  onChange: (patch: Partial<ProductQuery>) => void;
  loading?: boolean;
  showSearch?: boolean;
}

export function FiltersPanel({ facets, query, onChange, loading, showSearch }: PanelProps) {
  const t = useTranslations("shop");
  const tProduct = useTranslations("product");

  return (
    <div aria-busy={loading} data-testid="filters-panel">
      {showSearch ? (
        <div className="sidebar-widget">
          <SearchFilter key={query.q ?? ""} value={query.q ?? ""} onSubmit={(q) => onChange({ q: q || undefined })} />
        </div>
      ) : null}

      <Widget title={t("priceRange")}>
        <PriceRange
          key={`${query.minPrice ?? ""}-${query.maxPrice ?? ""}-${facets?.price.max ?? ""}`}
          bounds={facets?.price ?? null}
          min={query.minPrice}
          max={query.maxPrice}
          onChange={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
        />
      </Widget>

      {facets && facets.categories.length > 0 ? (
        <Widget title={t("categories")}>
          <CheckList
            name="category"
            options={facets.categories.map((c) => ({ value: c.slug, label: c.name, count: c.count }))}
            selected={query.category ?? []}
            onToggle={(value) => onChange({ category: toggleValue(query.category, value) })}
          />
        </Widget>
      ) : null}

      {facets && facets.brands.length > 0 ? (
        <Widget title={t("brands")}>
          <CheckList
            name="brand"
            options={facets.brands.map((b) => ({ value: b.slug, label: b.name, count: b.count }))}
            selected={query.brand ?? []}
            onToggle={(value) => onChange({ brand: toggleValue(query.brand, value) })}
          />
        </Widget>
      ) : null}

      {facets && facets.flavors.length > 0 ? (
        <Widget title={t("flavors")}>
          <CheckList
            name="flavor"
            options={facets.flavors.map((f) => ({ value: f.value, label: f.label, count: f.count }))}
            selected={query.flavor ?? []}
            onToggle={(value) => onChange({ flavor: toggleValue(query.flavor, value) })}
          />
        </Widget>
      ) : null}

      {facets && facets.nicotine.length > 0 ? (
        <Widget title={t("nicotine")}>
          <CheckList
            name="nicotine"
            options={facets.nicotine.map((n) => ({
              value: String(n.value),
              label: tProduct("nicotineMg", { value: n.value }),
              count: n.count,
            }))}
            selected={(query.nicotine ?? []).map(String)}
            onToggle={(value) => onChange({ nicotine: toggleValue(query.nicotine, Number(value)) })}
          />
        </Widget>
      ) : null}

      <Widget title={t("availability")}>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={Boolean(query.inStock)}
            onChange={(e) => onChange({ inStock: e.target.checked ? true : undefined })}
            data-testid="filter-in-stock"
          />
          {t("inStockOnly")}
        </label>
      </Widget>
    </div>
  );
}

function Widget({ title, children }: { title: string; children: ReactNode }) {
  const t = useTranslations("shop");
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <section className="sidebar-widget">
      <button
        type="button"
        className="widget-title-row"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        aria-label={t("toggleSection", { label: title })}
      >
        <span className="lead text-white">{title}</span>
        {open ? <Minus className="h-4 w-4" aria-hidden /> : <Plus className="h-5 w-5" aria-hidden />}
      </button>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

function CheckList({
  name,
  options,
  selected,
  onToggle,
}: {
  name: string;
  options: { value: string; label: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const t = useTranslations("shop");
  return (
    <ul className="filter-list">
      {options.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <li key={option.value}>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={checked}
                disabled={option.count === 0 && !checked}
                onChange={() => onToggle(option.value)}
                data-testid={`filter-${name}-${option.value}`}
              />
              {option.label}
            </label>
            <span className="text-gray" aria-hidden>
              {t("count", { count: String(option.count).padStart(2, "0") })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SearchFilter({ value, onSubmit }: { value: string; onSubmit: (q: string) => void }) {
  const t = useTranslations("shop");
  // Remounted (via key) whenever the URL query changes, so the draft never goes stale.
  const [draft, setDraft] = useState(value);
  const id = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(draft.trim().slice(0, 64));
  };
  return (
    <form role="search" onSubmit={submit} className="search-field">
      <label htmlFor={id} className="sr-only">
        {t("search")}
      </label>
      <input
        id={id}
        type="search"
        value={draft}
        maxLength={64}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t("searchPlaceholder")}
        autoComplete="off"
        data-testid="filter-search"
      />
      <button type="submit" className="icon-btn !min-h-8 !min-w-8 !text-gray hover:!text-primary-2" aria-label={t("search")}>
        <SearchIcon className="!h-4 !w-4" />
      </button>
    </form>
  );
}

const STEP = 500;

function PriceRange({
  bounds,
  min,
  max,
  onChange,
}: {
  bounds: { min: number; max: number } | null;
  min: number | undefined;
  max: number | undefined;
  onChange: (min: number | undefined, max: number | undefined) => void;
}) {
  const t = useTranslations("shop");
  const lowest = 0;
  const highest = Math.max(STEP, Math.ceil((bounds?.max ?? 50_000) / STEP) * STEP);
  const [low, setLow] = useState(min ?? lowest);
  const [high, setHigh] = useState(max ?? highest);
  // Remounted (via key) when the applied range or bounds change.
  const [dirty, setDirty] = useState(false);

  const debouncedLow = useDebouncedValue(low, 500);
  const debouncedHigh = useDebouncedValue(high, 500);

  useEffect(() => {
    if (!dirty) return;
    const nextMin = debouncedLow > lowest ? debouncedLow : undefined;
    const nextMax = debouncedHigh < highest ? debouncedHigh : undefined;
    if (nextMin !== min || nextMax !== max) onChange(nextMin, nextMax);
    // onChange identity changes with every query; only react to value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLow, debouncedHigh, dirty]);

  const setRange = (nextLow: number, nextHigh: number) => {
    setDirty(true);
    setLow(Math.max(lowest, Math.min(nextLow, nextHigh)));
    setHigh(Math.min(highest, Math.max(nextHigh, nextLow)));
  };

  const pct = (v: number) => ((v - lowest) / (highest - lowest)) * 100;

  return (
    <div>
      <div className="price-input mb-24">
        <label className="flex-1">
          <span className="mb-1 block text-white">{t("low")}</span>
          <input
            type="number"
            inputMode="numeric"
            min={lowest}
            max={highest}
            step={STEP}
            value={low}
            onChange={(e) => setRange(Number(e.target.value) || 0, high)}
            aria-label={t("minPrice")}
            data-testid="price-min"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-white">{t("high")}</span>
          <input
            type="number"
            inputMode="numeric"
            min={lowest}
            max={highest}
            step={STEP}
            value={high}
            onChange={(e) => setRange(low, Number(e.target.value) || 0)}
            aria-label={t("maxPrice")}
            data-testid="price-max"
          />
        </label>
      </div>
      <div className="range-slider">
        <div className="range-slider__track">
          <div className="range-slider__progress" style={{ left: `${pct(low)}%`, right: `${100 - pct(high)}%` }} />
        </div>
        <input
          type="range"
          min={lowest}
          max={highest}
          step={STEP}
          value={low}
          onChange={(e) => setRange(Number(e.target.value), high)}
          aria-label={t("minPrice")}
          aria-valuetext={formatAmd(low)}
        />
        <input
          type="range"
          min={lowest}
          max={highest}
          step={STEP}
          value={high}
          onChange={(e) => setRange(low, Number(e.target.value))}
          aria-label={t("maxPrice")}
          aria-valuetext={formatAmd(high)}
        />
      </div>
      <p className="mt-3 text-sm">
        {formatAmd(low)} — {formatAmd(high)}
      </p>
    </div>
  );
}

export function ActiveFilters({
  query,
  facets,
  onChange,
  onClearAll,
  hideQuery,
}: {
  query: ProductQuery;
  facets: Facets | null;
  onChange: (patch: Partial<ProductQuery>) => void;
  onClearAll: () => void;
  hideQuery?: boolean;
}) {
  const t = useTranslations("shop");
  const tProduct = useTranslations("product");
  const name = (list: { slug: string; name: string }[] | undefined, slug: string) => list?.find((x) => x.slug === slug)?.name ?? slug;
  const flavorName = (value: string) => facets?.flavors.find((f) => f.value === value)?.label ?? value;

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (query.q && !hideQuery) chips.push({ key: "q", label: `“${query.q}”`, remove: () => onChange({ q: undefined }) });
  for (const slug of query.category ?? [])
    chips.push({ key: `c-${slug}`, label: name(facets?.categories, slug), remove: () => onChange({ category: toggleValue(query.category, slug) }) });
  for (const slug of query.brand ?? [])
    chips.push({ key: `b-${slug}`, label: name(facets?.brands, slug), remove: () => onChange({ brand: toggleValue(query.brand, slug) }) });
  for (const value of query.flavor ?? [])
    chips.push({ key: `f-${value}`, label: flavorName(value), remove: () => onChange({ flavor: toggleValue(query.flavor, value) }) });
  for (const value of query.nicotine ?? [])
    chips.push({
      key: `n-${value}`,
      label: tProduct("nicotineMg", { value }),
      remove: () => onChange({ nicotine: toggleValue(query.nicotine, value) }),
    });
  if (query.minPrice !== undefined || query.maxPrice !== undefined)
    chips.push({
      key: "price",
      label: `${formatAmd(query.minPrice ?? 0)} — ${query.maxPrice !== undefined ? formatAmd(query.maxPrice) : "∞"}`,
      remove: () => onChange({ minPrice: undefined, maxPrice: undefined }),
    });
  if (query.inStock) chips.push({ key: "stock", label: t("inStockOnly"), remove: () => onChange({ inStock: undefined }) });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3" data-testid="active-filters">
      <span className="text-white">{t("activeFilters")}:</span>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <button type="button" className="chip" onClick={chip.remove} aria-label={t("removeFilter", { label: chip.label })}>
              {chip.label}
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="text-link ml-auto text-sm" onClick={onClearAll} data-testid="clear-filters">
        {t("clearAll")}
      </button>
    </div>
  );
}
