"use client";

import { Check, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAddToCart } from "@/hooks/use-add-to-cart";
import type { ProductCard } from "@/lib/api/types";
import { ProductCartIcon } from "@/components/icons";

/** The round purple cart action that slides into product cards on hover (reference). */
export function QuickAddButton({ product }: { product: ProductCard }) {
  const t = useTranslations("product");
  const { addToCart, state } = useAddToCart();

  if (!product.inStock) {
    return (
      <button type="button" className="product-card__action is-cart" disabled aria-label={`${t("outOfStock")}: ${product.name}`}>
        <ProductCartIcon />
      </button>
    );
  }

  if (!product.defaultVariantId) {
    return (
      <Link
        href={`/products/${product.slug}`}
        className="product-card__action is-cart"
        aria-label={`${t("chooseOptions")}: ${product.name}`}
        title={t("chooseOptions")}
      >
        <SlidersHorizontal aria-hidden />
      </Link>
    );
  }

  const variantId = product.defaultVariantId;
  const label =
    state === "loading" ? t("adding") : state === "success" ? t("added") : `${t("addToCart")}: ${product.name}`;

  return (
    <button
      type="button"
      className="product-card__action is-cart"
      onClick={() => void addToCart({ productId: product.id, variantId, quantity: 1, name: product.name })}
      disabled={state === "loading"}
      aria-busy={state === "loading"}
      aria-label={label}
      data-state={state}
      data-testid="quick-add"
    >
      {state === "loading" ? <span className="spinner" aria-hidden /> : state === "success" ? <Check aria-hidden /> : <ProductCartIcon />}
    </button>
  );
}
