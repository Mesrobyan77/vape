"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, setCsrfToken } from "@/lib/api/client";
import { useMe } from "@/hooks/use-me";
import { AdminLogin, MfaEnroll, MfaVerify } from "./AdminAuth";
import { AdminError } from "./ui";
import { DashboardSection } from "./sections/Dashboard";
import { ProductsSection } from "./sections/Products";
import { OrdersSection } from "./sections/Orders";
import { CustomersSection } from "./sections/Customers";
import { TaxonomySection } from "./sections/Taxonomy";
import { BlogSection } from "./sections/Blog";
import { MessagesSection } from "./sections/Messages";
import { CouponsSection } from "./sections/Coupons";
import { SettingsSection } from "./sections/Settings";
import { UploadsSection } from "./sections/Uploads";
import { InventorySection } from "./sections/Inventory";
import { PaymentsSection, AuditSection, SecuritySection } from "./sections/System";

export const ADMIN_SECTIONS = [
  { key: "", label: "Dashboard" },
  { key: "products", label: "Products" },
  { key: "inventory", label: "Inventory" },
  { key: "orders", label: "Orders" },
  { key: "customers", label: "Customers" },
  { key: "categories", label: "Categories" },
  { key: "brands", label: "Brands" },
  { key: "blog", label: "Blog" },
  { key: "messages", label: "Messages" },
  { key: "coupons", label: "Coupons" },
  { key: "settings", label: "Settings" },
  { key: "uploads", label: "Uploads" },
  { key: "payments", label: "Payments" },
  { key: "audit", label: "Audit log" },
  { key: "security", label: "Security" },
] as const;

export function AdminApp({ path }: { path: string[] }) {
  const me = useMe();
  if (me.isPending) {
    return (
      <div className="grid min-h-screen place-items-center" aria-busy="true">
        <span className="spinner h-8 w-8 text-primary-2" aria-label="Loading" />
      </div>
    );
  }
  if (me.isError) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <AdminError error={me.error} onRetry={() => me.refetch()} retrying={me.isFetching} />
      </div>
    );
  }
  const { user, session } = me.data;
  if (!user || user.role !== "admin") return <AdminLogin />;
  if (session.mfa === "enroll") return <MfaEnroll />;
  if (session.mfa === "verify") return <MfaVerify />;
  return <AdminShell path={path} email={user.email} />;
}

function AdminShell({ path, email }: { path: string[]; email: string }) {
  const client = useQueryClient();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [section = "", ...rest] = path;

  const logout = async () => {
    setLoggingOut(true);
    try {
      await api<void>("/auth/logout", { method: "POST" });
    } finally {
      setCsrfToken(null);
      client.clear();
      router.replace("/admin");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-white/10 bg-surface p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Link href="/admin" className="mb-6 block">
          <Image src="/media/logo.png" alt="Vape Hub admin" width={170} height={36} />
        </Link>
        <nav aria-label="Admin">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {ADMIN_SECTIONS.map((s) => {
              const active = s.key === section;
              return (
                <li key={s.key}>
                  <Link
                    href={s.key ? `/admin/${s.key}` : "/admin"}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-[5px] px-3 py-2 text-sm ${active ? "bg-primary text-white" : "hover:bg-white/5 hover:text-white"}`}
                  >
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-6 border-t border-white/10 pt-4 text-sm">
          <p className="mb-2 truncate" title={email}>
            {email}
          </p>
          <Link href="/hy" className="text-link mb-2 block">
            View storefront
          </Link>
          <button type="button" className="text-link" onClick={logout} disabled={loggingOut} data-testid="admin-logout">
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      <main id="main" className="min-w-0 p-4 sm:p-6 lg:p-8">
        <SectionRouter section={section} rest={rest} />
      </main>
    </div>
  );
}

function SectionRouter({ section, rest }: { section: string; rest: string[] }) {
  switch (section) {
    case "":
      return <DashboardSection />;
    case "products":
      return <ProductsSection id={rest[0]} />;
    case "inventory":
      return <InventorySection />;
    case "orders":
      return <OrdersSection id={rest[0]} />;
    case "customers":
      return <CustomersSection />;
    case "categories":
      return <TaxonomySection kind="categories" />;
    case "brands":
      return <TaxonomySection kind="brands" />;
    case "blog":
      return <BlogSection id={rest[0]} />;
    case "messages":
      return <MessagesSection />;
    case "coupons":
      return <CouponsSection />;
    case "settings":
      return <SettingsSection />;
    case "uploads":
      return <UploadsSection />;
    case "payments":
      return <PaymentsSection />;
    case "audit":
      return <AuditSection />;
    case "security":
      return <SecuritySection />;
    default:
      return <p role="alert">Unknown admin section.</p>;
  }
}
