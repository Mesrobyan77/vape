import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/api/types";
import { safely } from "@/lib/safe";
import { alternatesFor } from "@/lib/site";
import { getPublicSettings } from "@/server/storefront";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContactForm } from "@/components/content/ContactForm";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("title"), description: t("text"), alternates: alternatesFor(locale, "/contact") };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, settings] = await Promise.all([getTranslations("contact"), safely(() => getPublicSettings(locale))]);
  const store = settings.ok ? settings.data.store : null;

  return (
    <>
      <PageHeader title={t("title")} crumbs={[{ label: t("title") }]} />
      <section className="py-80">
        <div className="container-vh">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="surface p-4 sm:p-6">
              <h2 className="h6 panel-title mb-24">{t("heading")}</h2>
              <p className="mb-32">{t("text")}</p>
              <ContactForm />
            </div>
            {store ? (
              <aside className="surface h-fit p-6" aria-labelledby="contact-details">
                <h2 id="contact-details" className="h6 mb-24 text-white">
                  {t("details")}
                </h2>
                <ul className="footer-links footer-contacts">
                  <li>
                    <MapPin aria-hidden />
                    <span>{store.address}</span>
                  </li>
                  <li>
                    <Phone aria-hidden />
                    <a href={`tel:${store.phone.replace(/\s+/g, "")}`}>{store.phone}</a>
                  </li>
                  <li>
                    <Mail aria-hidden />
                    <a href={`mailto:${store.email}`}>{store.email}</a>
                  </li>
                  <li>
                    <Clock aria-hidden />
                    <span>
                      {t("hours")}: {store.hours}
                    </span>
                  </li>
                </ul>
              </aside>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
