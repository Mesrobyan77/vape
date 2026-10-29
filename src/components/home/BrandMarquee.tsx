import type { Brand } from "@/lib/api/types";
import { SafeImage } from "@/components/ui/SafeImage";

/** Continuous linear brand slider from the reference (slick autoplay, 6 s linear). */
export function BrandMarquee({ brands, label }: { brands: Brand[]; label: string }) {
  const withLogo = brands.filter((b) => b.logo);
  if (withLogo.length === 0) return null;
  // The track is rendered twice so the -50% translate loops seamlessly.
  const loop = [...withLogo, ...withLogo];
  return (
    <section className="py-80" aria-label={label}>
      <div className="brands-marquee">
        <ul className="brands-marquee__track">
          {loop.map((brand, i) => (
            <li key={`${brand.slug}-${i}`} className="brands-marquee__item" aria-hidden={i >= withLogo.length}>
              <SafeImage image={brand.logo} width={248} height={96} alt={brand.name} sizes="(min-width: 1200px) 14vw, 33vw" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
