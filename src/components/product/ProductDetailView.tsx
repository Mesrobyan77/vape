"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Truck, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import type { Locale, ProductDetail, Variant } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { useAddToCart } from "@/hooks/use-add-to-cart";
import { useSettings } from "@/components/providers/SettingsProvider";
import { QuantityControl } from "@/components/ui/QuantityControl";
import { ArrowRightIcon, ProductCartIcon } from "@/components/icons";
import { ProductGallery } from "./ProductGallery";

const LOW_STOCK = 5;

function pickInitialVariant(product: ProductDetail, requested: string | null): Variant | null {
  const byId = product.variants.find((v) => v.id === requested);
  return byId ?? product.variants.find((v) => v.available > 0) ?? product.variants[0] ?? null;
}

export function ProductDetailView({ initial }: { initial: ProductDetail }) {
  const t = useTranslations("product");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const settings = useSettings();
  const optionsId = useId();

  // Availability shown on screen is re-verified on mount; the server stays the authority.
  const product = useQuery({
    queryKey: ["product", locale, initial.slug],
    queryFn: ({ signal }) => api<ProductDetail>(`/products/${encodeURIComponent(initial.slug)}`, { query: { locale }, signal }),
    initialData: initial,
    initialDataUpdatedAt: 0,
    staleTime: 10_000,
  });
  const data = product.data;

  const [variantId, setVariantId] = useState<string | null>(() => pickInitialVariant(initial, searchParams.get("variant"))?.id ?? null);
  const variant = useMemo(() => data.variants.find((v) => v.id === variantId) ?? null, [data.variants, variantId]);
  const [requestedQuantity, setQuantity] = useState(1);
  const { addToCart, state } = useAddToCart();

  const available = variant?.available ?? 0;
  // Never exceed the latest verified availability (it can drop after a refetch).
  const quantity = available > 0 ? Math.min(requestedQuantity, available) : 1;

  const selectVariant = (v: Variant) => {
    setVariantId(v.id);
    setQuantity(1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", v.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const price = variant?.price ?? data.price;
  const compareAt = variant ? variant.compareAtPrice : data.compareAtPrice;
  const onSale = compareAt !== null && compareAt > price;
  const images = variant && variant.images.length > 0 ? variant.images : data.images;
  const purchasable = variant !== null && available > 0;

  const add = async (thenCheckout: boolean) => {
    if (!variant) return;
    const ok = await addToCart({ productId: data.id, variantId: variant.id, quantity, name: data.name });
    if (ok && thenCheckout) router.push("/checkout");
    if (!ok) void product.refetch();
  };

  const attributeRows = variant
    ? [
        variant.attributes.flavor ? { label: t("flavor"), value: variant.attributes.flavor } : null,
        typeof variant.attributes.nicotineMg === "number" ? { label: t("nicotine"), value: t("nicotineMg", { value: variant.attributes.nicotineMg }) } : null,
        typeof variant.attributes.volumeMl === "number" ? { label: t("volume"), value: t("volumeMl", { value: variant.attributes.volumeMl }) } : null,
        variant.attributes.color ? { label: t("color"), value: variant.attributes.color } : null,
        typeof variant.attributes.resistanceOhm === "number"
          ? { label: t("resistance"), value: t("resistanceOhm", { value: variant.attributes.resistanceOhm }) }
          : null,
      ].filter((row): row is { label: string; value: string } => row !== null)
    : [];

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-[1fr_minmax(0,0.85fr)] xl:gap-12">
      <ProductGallery images={images} productName={data.name} />

      <div data-testid="product-info">
        <h1 className="h4 mb-12 text-white">{data.name}</h1>
        <ul className="mb-32 flex flex-col gap-3">
          {data.brand ? (
            <li>
              <span className="mr-1">{t("brand")}:</span>
              <Link href={`/shop?brand=${data.brand.slug}`} className="text-white hover:text-primary-2">
                {data.brand.name}
              </Link>
            </li>
          ) : null}
          <li aria-live="polite" data-testid="stock-status">
            {!variant || available <= 0 ? (
              <span className="font-semibold text-danger">{t("outOfStock")}</span>
            ) : available <= LOW_STOCK ? (
              <span className="font-semibold text-warning">{t("lowStock", { count: available })}</span>
            ) : (
              <span className="font-semibold text-success">{t("inStock")}</span>
            )}
          </li>
        </ul>

        <p className="mb-32 flex flex-wrap items-baseline gap-2" aria-live="polite" data-testid="product-price">
          <span className="sr-only">{onSale ? t("salePrice") : t("price")}: </span>
          <span className="h5 text-white">{formatAmd(price)}</span>
          {onSale ? (
            <>
              <del className="h6 text-gray">
                <span className="sr-only">{t("regularPrice")}: </span>
                {formatAmd(compareAt!)}
              </del>
              <span className="badge">{t("sale")}</span>
            </>
          ) : null}
        </p>

        {data.shortDescription ? <p className="mb-32">{data.shortDescription}</p> : null}

        {data.variants.length > 1 ? (
          <fieldset className="mb-32">
            <legend className="bold-text mb-12 text-white" id={optionsId}>
              {t("options")}
            </legend>
            <div role="radiogroup" aria-labelledby={optionsId} className="flex flex-wrap gap-2" data-testid="variant-options">
              {data.variants.map((v) => {
                const soldOut = v.available <= 0;
                const selected = v.id === variantId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={soldOut}
                    onClick={() => selectVariant(v)}
                    className={`min-h-11 rounded-[5px] border px-4 py-2 text-left transition-colors ${
                      selected ? "border-primary-2 bg-primary text-white" : "border-white/40 text-white hover:border-primary-2"
                    } disabled:cursor-not-allowed disabled:border-white/15 disabled:text-gray disabled:line-through`}
                    data-testid="variant-option"
                  >
                    {soldOut ? t("variantSoldOut", { label: v.label }) : v.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <ul className="mb-32 flex flex-col gap-3">
          {data.category ? (
            <li>
              <span className="bold-text mr-1 text-white">{t("category")}:</span>
              <Link href={`/shop?category=${data.category.slug}`} className="hover:text-primary-2">
                {data.category.name}
              </Link>
            </li>
          ) : null}
          {variant ? (
            <li>
              <span className="bold-text mr-1 text-white">{t("sku")}:</span>
              <span data-testid="product-sku">{variant.sku}</span>
            </li>
          ) : null}
          {attributeRows.map((row) => (
            <li key={row.label}>
              <span className="bold-text mr-1 text-white">{row.label}:</span>
              {row.value}
            </li>
          ))}
          {data.tags.length ? (
            <li>
              <span className="bold-text mr-1 text-white">{t("tags")}:</span>
              {data.tags.join(", ")}
            </li>
          ) : null}
        </ul>

        <div className="mb-16 flex flex-wrap items-center gap-3">
          <QuantityControl
            value={quantity}
            max={Math.max(1, available)}
            disabled={!purchasable || state === "loading"}
            onChange={setQuantity}
          />
          <button
            type="button"
            className="cus-btn"
            disabled={!purchasable || state === "loading"}
            aria-busy={state === "loading"}
            onClick={() => void add(false)}
            data-testid="add-to-cart"
            data-state={state}
          >
            {state === "loading" ? <span className="spinner" aria-hidden /> : state === "success" ? <Check aria-hidden /> : <ProductCartIcon />}
            {!purchasable ? t("outOfStock") : state === "loading" ? t("adding") : state === "success" ? t("added") : t("addToCart")}
          </button>
          <button
            type="button"
            className="cus-btn is-filled"
            disabled={!purchasable || state === "loading"}
            onClick={() => void add(true)}
            data-testid="buy-now"
          >
            {t("buyNow")}
            <ArrowRightIcon />
          </button>
        </div>
        {purchasable && quantity >= available ? (
          <p className="mb-16 text-sm text-warning" role="status">
            {t("maxReached")}
          </p>
        ) : null}

        {data.warnings.length ? (
          <div className="form-alert is-warning mb-24 mt-24" data-testid="product-warnings">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="mb-1 font-bold">{t("warnings")}</p>
              <ul className="list-disc pl-5">
                {data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {settings ? (
          <div className="surface flex gap-3 rounded-[10px] p-4">
            <Truck className="h-6 w-6 shrink-0 text-primary-2" aria-hidden />
            <div>
              <p className="mb-1 font-bold text-white">{t("deliveryTitle")}</p>
              <p className="text-sm">
                {t("deliveryText", {
                  yerevan: formatAmd(settings.shipping.yerevanFee),
                  other: formatAmd(settings.shipping.otherFee),
                  threshold: formatAmd(settings.shipping.freeThreshold),
                })}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {data.description ? (
        <section className="md:col-span-2" aria-labelledby="product-description">
          <h2 id="product-description" className="h5 mb-16 text-white">
            {t("description")}
          </h2>
          <div className="prose-vh max-w-[900px]">
            {data.description.split(/\n{2,}/).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
