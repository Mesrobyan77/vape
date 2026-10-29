import { notFound } from "next/navigation";
import { AdminApp } from "@/components/admin/AdminApp";

const SECTIONS = new Set([
  "",
  "products",
  "inventory",
  "orders",
  "customers",
  "categories",
  "brands",
  "blog",
  "messages",
  "coupons",
  "settings",
  "uploads",
  "payments",
  "audit",
  "security",
]);
const SEGMENT = /^[a-z0-9-]{1,40}$/;

export default async function AdminPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const path = (await params).path ?? [];
  if (path.length > 2 || !SECTIONS.has(path[0] ?? "") || !path.every((s) => SEGMENT.test(s))) notFound();
  return <AdminApp path={path} />;
}
