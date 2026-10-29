import Image from "next/image";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { PublicSettings } from "@/lib/api/types";
import { FacebookIcon, InstagramIcon, XLogoIcon } from "@/components/icons";

const SOCIAL = [
  { key: "Instagram", url: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM, Icon: InstagramIcon },
  { key: "Facebook", url: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK, Icon: FacebookIcon },
  { key: "X", url: process.env.NEXT_PUBLIC_SOCIAL_X, Icon: XLogoIcon },
].filter((s): s is typeof s & { url: string } => typeof s.url === "string" && s.url.startsWith("https://"));

function PaymentTile({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <li>
      <span
        className="grid h-[42px] w-[clamp(60px,4.271vw,100px)] place-items-center rounded-[6px] bg-white px-2 text-center text-[12px] font-bold leading-tight text-[#1a1f71] sm:h-[56px]"
        title={label}
      >
        {children}
      </span>
    </li>
  );
}

export async function Footer({ settings }: { settings: PublicSettings | null }) {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();
  const enabled = new Set(settings?.paymentMethods.filter((m) => m.enabled).map((m) => m.method) ?? ["cod"]);

  return (
    <footer className="py-40" data-testid="site-footer">
      <div className="container-vh">
        <div className="grid gap-x-6 gap-y-12 pb-80 sm:grid-cols-12 lg:gap-y-6">
          <div className="text-center sm:col-span-12 lg:col-span-3 lg:text-left">
            <Link href="/" className="mb-16 inline-block" aria-label="Vape Hub — home">
              <Image src="/media/logo.png" alt="Vape Hub" width={229} height={48} />
            </Link>
            <p className="mb-24">{t("tagline")}</p>
            {SOCIAL.length ? (
              <ul className="social-icons justify-center lg:justify-start" aria-label={t("social")}>
                {SOCIAL.map(({ key, url, Icon }) => (
                  <li key={key}>
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={key}>
                      <Icon className="h-6 w-6" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <nav className="text-center sm:col-span-3 sm:text-left lg:col-span-3" aria-labelledby="footer-links">
            <h2 id="footer-links" className="h6 mb-16 text-white">
              {t("usefulLinks")}
            </h2>
            <ul className="footer-links">
              <li>
                <Link href="/about">{t("aboutUs")}</Link>
              </li>
              <li>
                <Link href="/shop">{t("productItems")}</Link>
              </li>
              <li>
                <Link href="/contact">{t("contact")}</Link>
              </li>
              <li>
                <Link href="/checkout">{t("checkout")}</Link>
              </li>
              <li>
                <Link href="/blog">{t("blog")}</Link>
              </li>
              <li>
                <Link href="/faq">{t("faq")}</Link>
              </li>
            </ul>
          </nav>

          <div className="text-center sm:col-span-5 sm:text-left lg:col-span-3">
            <h2 className="h6 mb-16 text-white">{t("contactUs")}</h2>
            {settings ? (
              <ul className="footer-links footer-contacts">
                <li>
                  <MapPin aria-hidden />
                  <span>{settings.store.address}</span>
                </li>
                <li>
                  <Phone aria-hidden />
                  <a href={`tel:${settings.store.phone.replace(/\s+/g, "")}`}>{settings.store.phone}</a>
                </li>
                <li>
                  <Mail aria-hidden />
                  <a href={`mailto:${settings.store.email}`}>{settings.store.email}</a>
                </li>
                <li>
                  <Clock aria-hidden />
                  <span>{settings.store.hours}</span>
                </li>
              </ul>
            ) : (
              <Link href="/contact" className="text-link">
                {t("contact")}
              </Link>
            )}
          </div>

          <div className="text-center sm:col-span-4 sm:text-left lg:col-span-3">
            <h2 className="h6 mb-16 text-white">{t("paymentsDelivery")}</h2>
            <ul className="payment-methods mb-16" aria-label={t("paymentsDelivery")}>
              <PaymentTile label="Cash on delivery">
                <span className="text-[#0c0c0d]">CASH</span>
              </PaymentTile>
              {enabled.has("idram") ? (
                <PaymentTile label="Idram">
                  <span className="text-[#e5272a]">Idram</span>
                </PaymentTile>
              ) : null}
              {enabled.has("arca") ? (
                <>
                  <PaymentTile label="ArCa">
                    <span>ArCa</span>
                  </PaymentTile>
                  <li>
                    <Image src="/media/icons/payment-01.png" alt="Visa" width={81} height={56} />
                  </li>
                  <li>
                    <Image src="/media/icons/payment-03.png" alt="Mastercard" width={81} height={56} />
                  </li>
                </>
              ) : null}
            </ul>
            <p className="text-sm">{t("paymentNote")}</p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 text-center text-sm">
          <ul className="mb-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
            <li>
              <Link href="/privacy" className="hover:text-primary-2">
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-primary-2">
                {t("terms")}
              </Link>
            </li>
            <li>
              <Link href="/shipping-returns" className="hover:text-primary-2">
                {t("shippingReturns")}
              </Link>
            </li>
          </ul>
          <p className="mb-2 font-semibold text-warning" data-testid="age-warning">
            {t("ageWarning")}
          </p>
          <p>{t("copyright", { year })}</p>
        </div>
      </div>
    </footer>
  );
}
