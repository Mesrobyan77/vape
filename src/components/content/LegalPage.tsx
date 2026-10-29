import { getFormatter, getTranslations } from "next-intl/server";
import { TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

const LAST_UPDATED = new Date("2026-10-23T00:00:00Z");

/** Legal pages share one layout; each is clearly marked as requiring legal review. */
export async function LegalPage({
  doc,
  sections,
  values,
}: {
  doc: "privacy" | "terms" | "shipping";
  sections: string[];
  values?: Record<string, string>;
}) {
  const t = await getTranslations("legal");
  const format = await getFormatter();
  return (
    <>
      <PageHeader title={t(`${doc}.title`)} crumbs={[{ label: t(`${doc}.title`) }]} />
      <section className="py-80">
        <div className="container-vh">
          <div className="mx-auto max-w-[900px]">
            <p className="form-alert is-warning mb-32" role="note" data-testid="legal-review-notice">
              <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
              {t("reviewNotice")}
            </p>
            <p className="mb-32 text-sm">{t("lastUpdated", { date: format.dateTime(LAST_UPDATED, { dateStyle: "long" }) })}</p>
            <div className="prose-vh">
              {sections.map((key) => (
                <section key={key}>
                  <h2 className="h5">{t(`${doc}.sections.${key}.title`)}</h2>
                  <p>{t(`${doc}.sections.${key}.body`, values)}</p>
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
