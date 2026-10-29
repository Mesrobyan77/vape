import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon } from "@/components/icons";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <section className="py-80" data-testid="not-found">
      <div className="container-vh text-center">
        <p className="hero-title mb-16 font-heading text-[clamp(96px,12vw,220px)] font-bold leading-none" aria-hidden>
          <span>{t("code")}</span>
        </p>
        <h1 className="h2 mb-16 text-white">{t("title")}</h1>
        <p className="mx-auto mb-48 max-w-[520px]">{t("body")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="cus-btn">
            {t("home")}
            <ArrowRightIcon />
          </Link>
          <Link href="/shop" className="cus-btn is-filled">
            {t("shop")}
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}
