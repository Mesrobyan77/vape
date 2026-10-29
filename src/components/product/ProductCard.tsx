import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ProductCard as ProductCardData } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { SafeImage } from "@/components/ui/SafeImage";
import { QuickAddButton } from "./QuickAddButton";

/**
 * Reference product card: image with hover zoom, title, two-line excerpt, price, and
 * a cart action that slides in on hover. The reference's five decorative stars are
 * intentionally omitted — the store has no reviews, and we do not show fake ratings.
 */
export function ProductCard({ product, priority = false, headingLevel = 3 }: { product: ProductCardData; priority?: boolean; headingLevel?: 2 | 3 }) {
  const t = useTranslations("product");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const onSale = product.compareAtPrice !== null && product.compareAtPrice > product.price;

  return (
    <article className="product-card" data-testid="product-card" data-slug={product.slug}>
      <div className="product-card__badges">
        {onSale ? <span className="badge">{t("sale")}</span> : null}
        {product.isNew ? <span className="badge is-light">{t("new")}</span> : null}
        {!product.inStock ? <span className="badge is-muted">{t("outOfStock")}</span> : null}
      </div>
      <div className="product-card__media">
        <SafeImage
          image={product.image}
          width={308}
          height={332}
          sizes="(min-width: 1200px) 18vw, (min-width: 768px) 30vw, 50vw"
          priority={priority}
          decorative
        />
      </div>
      <div className="product-card__body">
        <Heading className="h6 mb-8">
          <Link href={`/products/${product.slug}`} className="product-card__title">
            {product.name}
          </Link>
        </Heading>
        {product.brand ? <p className="mb-8 text-sm text-primary-2">{product.brand.name}</p> : null}
        <p className="product-card__desc mb-20">{product.shortDescription}</p>
        <p className="product-card__price">
          {product.variantCount > 1 ? (
            <span className="h6 text-white">{t("from", { price: formatAmd(product.price) })}</span>
          ) : (
            <span className="h6 text-white">{formatAmd(product.price)}</span>
          )}
          {onSale ? (
            <del>
              <span className="sr-only">{t("regularPrice")}: </span>
              {formatAmd(product.compareAtPrice!)}
            </del>
          ) : null}
        </p>
      </div>
      <QuickAddButton product={product} />
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="product-card" aria-hidden data-testid="product-skeleton">
      <div className="product-card__media">
        <div className="skeleton aspect-[308/332] w-full" />
      </div>
      <div className="product-card__body space-y-3">
        <div className="skeleton h-5 w-2/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-5 w-1/3" />
      </div>
    </div>
  );
}
