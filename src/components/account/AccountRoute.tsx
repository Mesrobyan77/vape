import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader, type Crumb } from "@/components/layout/PageHeader";

/** Server wrapper shared by every account route: reference page header + breadcrumbs. */
export async function AccountRoute({ title, crumbs = [], children }: { title: string; crumbs?: Crumb[]; children: ReactNode }) {
  const t = await getTranslations("account");
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: t("title"), href: "/account" }, ...crumbs]} />
      <section className="py-80">
        <div className="container-vh">{children}</div>
      </section>
    </>
  );
}

export const privateMetadata = { robots: { index: false, follow: false } } as const;
