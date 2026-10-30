"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent,
  Boxes,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Newspaper,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tags,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import cn from "clsx";
import { api, setCsrfToken } from "@/lib/api/client";
import type { AdminDashboard } from "@/lib/api/types";
import { useMe } from "@/hooks/use-me";
import { useDialog, useOutsideClick } from "@/hooks/use-dialog";
import { AdminLogin, MfaEnroll, MfaVerify } from "./AdminAuth";
import { AdminError, useAdminGet, useLocalFlag } from "./ui";
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

const COLLAPSE_KEY = "vh.admin.nav";

export interface AdminSection {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: NavGroupId;
}

type NavGroupId = "overview" | "operations" | "catalog" | "content" | "system";

const NAV_GROUP_LABEL: Record<NavGroupId, string> = {
  overview: "Overview",
  operations: "Operations",
  catalog: "Catalog",
  content: "Content & growth",
  system: "System",
};

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { key: "", label: "Dashboard", href: "/admin", icon: LayoutDashboard, group: "overview" },
  { key: "orders", label: "Orders", href: "/admin/orders", icon: ShoppingBag, group: "operations" },
  { key: "inventory", label: "Inventory", href: "/admin/inventory", icon: Boxes, group: "operations" },
  { key: "messages", label: "Messages", href: "/admin/messages", icon: MessageSquare, group: "operations" },
  { key: "customers", label: "Customers", href: "/admin/customers", icon: Users, group: "operations" },
  { key: "products", label: "Products", href: "/admin/products", icon: Package, group: "catalog" },
  { key: "categories", label: "Categories", href: "/admin/categories", icon: FolderTree, group: "catalog" },
  { key: "brands", label: "Brands", href: "/admin/brands", icon: Tags, group: "catalog" },
  { key: "uploads", label: "Uploads", href: "/admin/uploads", icon: ImageIcon, group: "catalog" },
  { key: "blog", label: "Blog", href: "/admin/blog", icon: Newspaper, group: "content" },
  { key: "coupons", label: "Coupons", href: "/admin/coupons", icon: BadgePercent, group: "content" },
  { key: "settings", label: "Store settings", href: "/admin/settings", icon: Settings2, group: "system" },
  { key: "payments", label: "Payments", href: "/admin/payments", icon: CreditCard, group: "system" },
  { key: "audit", label: "Audit log", href: "/admin/audit", icon: ScrollText, group: "system" },
  { key: "security", label: "Security", href: "/admin/security", icon: ShieldCheck, group: "system" },
];

const NAV_GROUPS: NavGroupId[] = ["overview", "operations", "catalog", "content", "system"];

export function AdminApp({ path }: { path: string[] }) {
  const me = useMe();
  if (me.isPending) {
    return (
      <div className="grid min-h-screen place-items-center" aria-busy="true">
        <span className="adm-spinner h-6 w-6 text-[color:var(--adm-accent)]" role="status" aria-label="Loading admin" />
      </div>
    );
  }
  if (me.isError) {
    return (
      <div className="mx-auto w-full max-w-[520px] p-4 pt-16">
        <AdminError error={me.error} onRetry={() => me.refetch()} retrying={me.isFetching} />
      </div>
    );
  }
  const { user, session } = me.data;
  if (!user || user.role !== "admin") return <AdminLogin />;
  if (session.mfa === "enroll") return <MfaEnroll />;
  if (session.mfa === "verify") return <MfaVerify />;
  return <AdminShell path={path} email={user.email} name={user.name} />;
}

function useQueueCounts() {
  const q = useAdminGet<AdminDashboard>("/admin/dashboard", ["dashboard"]);
  return {
    orders: (q.data?.pendingOrders ?? 0) + (q.data?.awaitingPayment ?? 0),
    ordersAlert: (q.data?.reconciliationRequired ?? 0) > 0,
    inventory: q.data?.lowStock.length ?? 0,
  };
}

function AdminShell({ path, email, name }: { path: string[]; email: string; name: string }) {
  const client = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useLocalFlag(COLLAPSE_KEY);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const queues = useQueueCounts();
  const [section = "", ...rest] = path;

  // Navigating away closes the mobile drawer; adjusting during render avoids an effect that
  // would otherwise fight the click that opened it.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  const closeDrawer = () => setDrawerOpen(false);
  const toggleCollapsed = () => setCollapsed(!collapsed);

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

  const counts: Record<string, { value: number; alert?: boolean }> = {
    orders: { value: queues.orders, alert: queues.ordersAlert },
    inventory: { value: queues.inventory },
  };

  const current = ADMIN_SECTIONS.find((s) => s.key === section);

  return (
    <div className={cn("adm-shell", collapsed && "is-collapsed")}>
      <a href="#admin-main" className="adm-skip">
        Skip to content
      </a>

      <aside className={cn("adm-sidebar", collapsed && "is-rail")} aria-label="Admin">
        <div className="adm-sidebar-top">
          <Link href="/admin" className="adm-brand">
            <span className="adm-brand-mark" aria-hidden>
              VH
            </span>
            <span className="adm-brand-text">
              Vape Hub
              <small>Admin</small>
            </span>
          </Link>
          <button
            type="button"
            className="adm-collapse hidden lg:inline-flex"
            onClick={toggleCollapsed}
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            data-testid="nav-collapse"
          >
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          </button>
        </div>

        <nav className="adm-nav">
          <AdminNav section={section} counts={counts} />
        </nav>

        <div className="adm-sidebar-foot">
          <Link href="/hy" className="adm-nav-link" title="View storefront">
            <Store aria-hidden />
            <span className="adm-nav-text">View storefront</span>
          </Link>
          <button type="button" className="adm-nav-link" onClick={logout} disabled={loggingOut} data-testid="admin-logout" title="Sign out">
            <LogOut aria-hidden />
            <span className="adm-nav-text">{loggingOut ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-topbar">
          <button type="button" className="adm-iconbtn lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Open navigation" data-testid="nav-open">
            <Menu aria-hidden />
          </button>
          <Breadcrumbs section={section} rest={rest} currentLabel={current?.label ?? "Admin"} />
          <div className="adm-topbar-right">
            <UserMenu email={email} name={name} />
          </div>
        </header>
        <main id="admin-main" className="adm-content">
          <SectionRouter section={section} rest={rest} />
        </main>
      </div>

      {drawerOpen ? (
        <NavDrawer section={section} counts={counts} onClose={closeDrawer}>
          <div className="adm-sidebar-foot">
            <Link href="/hy" className="adm-nav-link" onClick={closeDrawer}>
              <Store aria-hidden />
              <span className="adm-nav-text">View storefront</span>
            </Link>
            <button type="button" className="adm-nav-link" onClick={logout} disabled={loggingOut}>
              <LogOut aria-hidden />
              <span className="adm-nav-text">{loggingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        </NavDrawer>
      ) : null}
    </div>
  );
}

function AdminNav({ section, counts }: { section: string; counts: Record<string, { value: number; alert?: boolean }> }) {
  return (
    <>
      {NAV_GROUPS.map((group) => {
        const items = ADMIN_SECTIONS.filter((s) => s.group === group);
        return (
          <div className="adm-nav-group" key={group}>
            <p className="adm-nav-group-label">{NAV_GROUP_LABEL[group]}</p>
            <ul className="adm-nav-group-list">
              {items.map((s) => {
                const active = s.key === section;
                const badge = counts[s.key];
                const Icon = s.icon;
                return (
                  <li key={s.key || "dashboard"}>
                    <Link
                      href={s.href}
                      aria-current={active ? "page" : undefined}
                      className={cn("adm-nav-link", active && "is-active")}
                      data-label={s.label}
                      data-testid={`nav-${s.key || "dashboard"}`}
                    >
                      <Icon aria-hidden />
                      <span className="adm-nav-text">{s.label}</span>
                      {badge && badge.value > 0 ? (
                        <span className={cn("adm-nav-count", badge.alert && "is-alert")}>{badge.value > 99 ? "99+" : badge.value}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}

function NavDrawer({
  section,
  counts,
  onClose,
  children,
}: {
  section: string;
  counts: Record<string, { value: number; alert?: boolean }>;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, true, onClose);
  return (
    <>
      <button type="button" className="adm-scrim lg:hidden" onClick={onClose} aria-label="Close navigation" tabIndex={-1} />
      <div ref={ref} className="adm-drawer lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
        <div className="adm-sidebar-top">
          <span className="adm-brand">
            <span className="adm-brand-mark" aria-hidden>
              VH
            </span>
            <span className="adm-brand-text">
              Vape Hub
              <small>Admin</small>
            </span>
          </span>
          <button type="button" className="adm-iconbtn" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Close navigation">
            <X aria-hidden />
          </button>
        </div>
        <nav className="adm-nav" aria-label="Admin">
          <AdminNav section={section} counts={counts} />
        </nav>
        {children}
      </div>
    </>
  );
}

function Breadcrumbs({ section, rest, currentLabel }: { section: string; rest: string[]; currentLabel: string }) {
  const detail = rest[0];
  return (
    <nav aria-label="Breadcrumb" className="adm-crumb">
      <Link href="/admin">Admin</Link>
      <ChevronRight aria-hidden />
      {detail ? <Link href={section ? `/admin/${section}` : "/admin"}>{currentLabel}</Link> : <span className="is-current">{currentLabel}</span>}
      {detail ? (
        <>
          <ChevronRight aria-hidden />
          <span className="is-current">{detail === "new" ? "New" : "Detail"}</span>
        </>
      ) : null}
    </nav>
  );
}

function UserMenu({ email, name }: { email: string; name: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useOutsideClick([wrapRef], open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="adm-user" ref={wrapRef}>
      <button
        type="button"
        className="adm-user-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="user-menu"
      >
        <span className="adm-avatar" aria-hidden>
          {initials || "AD"}
        </span>
        <span>{name}</span>
        <ChevronDown aria-hidden />
      </button>
      {open ? (
        <div className="adm-user-menu" role="menu">
          <div className="adm-user-menu-head">
            <p>{name}</p>
            <p>{email}</p>
          </div>
          <Link href="/admin/security" className="adm-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <ShieldCheck aria-hidden /> Security &amp; recovery codes
          </Link>
          <Link href="/hy" className="adm-menu-item" role="menuitem">
            <Store aria-hidden /> View storefront
          </Link>
        </div>
      ) : null}
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
      return (
        <p className="adm-alert is-error" role="alert">
          Unknown admin section.
        </p>
      );
  }
}
