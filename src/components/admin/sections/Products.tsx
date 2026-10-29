"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import type { AdminBrand, AdminCategory, AdminImage, AdminProduct, AdminVariant, Localized, VariantAttributes } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { useToast } from "@/components/providers/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  AdminError,
  AdminTable,
  adminErrorText,
  emptyLocalized,
  fieldError,
  ImagesEditor,
  LocalizedFields,
  PageTitle,
  Panel,
  SaveBar,
  SelectInput,
  TextInput,
  Toggle,
  useAdminGet,
  useAdminList,
} from "../ui";

export function ProductsSection({ id }: { id?: string }) {
  if (id === "new") return <ProductEditor />;
  if (id) return <ProductLoader id={id} />;
  return <ProductsList />;
}

function ProductsList() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const list = useAdminList<AdminProduct>("/admin/products", { page, pageSize: 20, q: search || undefined, status: status || undefined }, "products");

  return (
    <>
      <PageTitle
        actions={
          <Link href="/admin/products/new" className="cus-btn is-filled is-sm" data-testid="new-product">
            New product
          </Link>
        }
      >
        Products
      </PageTitle>
      <Panel>
        <form
          className="mb-16 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q.trim());
          }}
        >
          <div className="w-64">
            <TextInput label="Search (name, slug, SKU)" value={q} onChange={setQ} />
          </div>
          <div className="w-44">
            <SelectInput
              label="Status"
              value={status}
              onChange={(v) => {
                setPage(1);
                setStatus(v);
              }}
              options={[
                { value: "", label: "All" },
                { value: "active", label: "Active" },
                { value: "draft", label: "Draft" },
                { value: "archived", label: "Archived" },
              ]}
            />
          </div>
          <button type="submit" className="cus-btn is-sm">
            Search
          </button>
        </form>
        <AdminTable
          testId="admin-products"
          query={list}
          rowKey={(p) => p.id}
          empty="No products match."
          onPage={setPage}
          columns={[
            {
              header: "Product",
              cell: (p) => (
                <Link href={`/admin/products/${p.id}`} className="text-white hover:text-primary-2">
                  {p.name.en || p.name.hy}
                  <span className="block text-xs text-gray">{p.slug}</span>
                </Link>
              ),
            },
            { header: "Status", cell: (p) => <span className="capitalize">{p.status}</span> },
            { header: "Variants", cell: (p) => p.variants.length },
            { header: "Stock", cell: (p) => p.variants.reduce((n, v) => n + (v.active ? v.stock : 0), 0) },
            { header: "From", cell: (p) => formatAmd(p.minPrice) },
            { header: "Featured", cell: (p) => (p.featured ? "Yes" : "—") },
          ]}
        />
      </Panel>
    </>
  );
}

function ProductLoader({ id }: { id: string }) {
  const q = useAdminGet<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`, ["product", id]);
  if (q.isPending) return <div className="skeleton h-[600px]" aria-busy="true" />;
  if (q.isError) return <AdminError error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />;
  return <ProductEditor product={q.data} />;
}

interface VariantDraft {
  sku: string;
  label: Localized;
  price: string;
  salePrice: string;
  stock: string;
  flavor: string;
  nicotineMg: string;
  volumeMl: string;
  color: string;
  resistanceOhm: string;
  active: boolean;
}

const emptyVariant = (): VariantDraft => ({
  sku: "",
  label: emptyLocalized(),
  price: "",
  salePrice: "",
  stock: "0",
  flavor: "",
  nicotineMg: "",
  volumeMl: "",
  color: "",
  resistanceOhm: "",
  active: true,
});

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function attributesOf(d: VariantDraft): VariantAttributes {
  return {
    flavor: d.flavor.trim() || null,
    nicotineMg: num(d.nicotineMg),
    volumeMl: num(d.volumeMl),
    color: d.color.trim() || null,
    resistanceOhm: num(d.resistanceOhm),
  };
}

function ProductEditor({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const categories = useAdminGet<AdminCategory[]>("/admin/categories", ["categories"]);
  const brands = useAdminGet<AdminBrand[]>("/admin/brands", ["brands"]);

  const [slug, setSlug] = useState(product?.slug ?? "");
  const [name, setName] = useState<Localized>(product?.name ?? emptyLocalized());
  const [shortDescription, setShort] = useState<Localized>(product?.shortDescription ?? emptyLocalized());
  const [description, setDescription] = useState<Localized>(product?.description ?? emptyLocalized());
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [tags, setTags] = useState(product?.tags.join(", ") ?? "");
  const [images, setImages] = useState<AdminImage[]>(product?.images ?? []);
  const [status, setStatus] = useState<AdminProduct["status"]>(product?.status ?? "draft");
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [warning, setWarning] = useState<Localized>(product?.warnings[0] ?? emptyLocalized());
  const [seoTitle, setSeoTitle] = useState<Localized>(product?.seo.title ?? emptyLocalized());
  const [seoDescription, setSeoDescription] = useState<Localized>(product?.seo.description ?? emptyLocalized());
  const [newVariants, setNewVariants] = useState<VariantDraft[]>(product ? [] : [emptyVariant()]);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const base = {
        slug: slug.trim(),
        name,
        shortDescription,
        description,
        brandId: brandId || null,
        categoryId: categoryId || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        images,
        status,
        featured,
        warnings: warning.hy || warning.ru || warning.en ? [warning] : [],
        seo: { title: seoTitle, description: seoDescription },
      };
      if (product) return api<AdminProduct>(`/admin/products/${product.id}`, { method: "PATCH", body: base });
      return api<AdminProduct>("/admin/products", {
        method: "POST",
        body: {
          ...base,
          variants: newVariants.map((v) => ({
            sku: v.sku.trim(),
            label: v.label,
            price: Number(v.price),
            salePrice: num(v.salePrice),
            stock: Number(v.stock),
            attributes: attributesOf(v),
            images: [],
            active: v.active,
          })),
        },
      });
    },
    onSuccess: (saved) => {
      toast.success("Product saved.");
      client.setQueryData(["admin", "product", saved.id], saved);
      void client.invalidateQueries({ queryKey: ["admin", "products"] });
      if (!product) router.push(`/admin/products/${saved.id}`);
    },
    onError: (err) => toast.error(adminErrorText(err)),
  });

  const lifecycle = useMutation({
    mutationFn: async (action: "archive" | "delete") => {
      if (!product) return;
      if (action === "archive") await api(`/admin/products/${product.id}/archive`, { method: "POST", body: {} });
      else await api(`/admin/products/${product.id}`, { method: "DELETE" });
    },
    onSuccess: (_d, action) => {
      setConfirm(null);
      toast.success(action === "archive" ? "Product archived." : "Product deleted.");
      void client.invalidateQueries({ queryKey: ["admin"] });
      router.push("/admin/products");
    },
    onError: (err) => {
      setConfirm(null);
      toast.error(adminErrorText(err));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!save.isPending) save.mutate();
  };

  return (
    <>
      <PageTitle
        actions={
          product ? (
            <div className="flex gap-2">
              <a href={`/hy/products/${product.slug}`} target="_blank" rel="noreferrer" className="cus-btn is-sm">
                View
              </a>
              <button type="button" className="cus-btn is-sm" onClick={() => setConfirm("archive")} disabled={product.status === "archived"}>
                Archive
              </button>
              <button type="button" className="cus-btn is-sm is-danger" onClick={() => setConfirm("delete")} data-testid="delete-product">
                Delete
              </button>
            </div>
          ) : null
        }
      >
        {product ? `Edit: ${product.name.en || product.name.hy}` : "New product"}
      </PageTitle>

      <form onSubmit={submit} className="space-y-6" data-testid="product-form">
        {save.isError ? <AdminError error={save.error} /> : null}
        <Panel title="Basics">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput label="Slug" value={slug} onChange={setSlug} required error={fieldError(save.error, "slug")} testId="product-slug" />
              <SelectInput
                label="Status"
                value={status}
                onChange={(v) => setStatus(v as AdminProduct["status"])}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active (visible)" },
                  { value: "archived", label: "Archived" },
                ]}
                testId="product-status"
              />
              <div className="flex items-end pb-3">
                <Toggle label="Featured on homepage" checked={featured} onChange={setFeatured} />
              </div>
            </div>
            <LocalizedFields label="Name" value={name} onChange={setName} required error={fieldError(save.error, "name")} testId="product-name" />
            <LocalizedFields label="Short description" value={shortDescription} onChange={setShort} />
            <LocalizedFields label="Description (plain text, blank line between paragraphs)" value={description} onChange={setDescription} multiline />
            <div className="grid gap-4 md:grid-cols-3">
              <SelectInput
                label="Category"
                value={categoryId}
                onChange={setCategoryId}
                options={[{ value: "", label: "— none —" }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name.en || c.name.hy }))]}
              />
              <SelectInput label="Brand" value={brandId} onChange={setBrandId} options={[{ value: "", label: "— none —" }, ...(brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))]} />
              <TextInput label="Tags (comma separated)" value={tags} onChange={setTags} />
            </div>
          </div>
        </Panel>
        <Panel title="Images">
          <ImagesEditor label="Product gallery" images={images} onChange={setImages} />
        </Panel>
        <Panel title="Compliance & SEO">
          <div className="space-y-4">
            <LocalizedFields label="Mandatory warning (nicotine, etc.)" value={warning} onChange={setWarning} multiline />
            <LocalizedFields label="SEO title" value={seoTitle} onChange={setSeoTitle} />
            <LocalizedFields label="SEO description" value={seoDescription} onChange={setSeoDescription} />
          </div>
        </Panel>
        {!product ? (
          <Panel
            title="Variants"
            actions={
              <button type="button" className="cus-btn is-sm" onClick={() => setNewVariants((v) => [...v, emptyVariant()])}>
                Add variant
              </button>
            }
          >
            <div className="space-y-4">
              {newVariants.map((v, i) => (
                <VariantFields
                  key={i}
                  draft={v}
                  onChange={(next) => setNewVariants((all) => all.map((x, j) => (j === i ? next : x)))}
                  onRemove={newVariants.length > 1 ? () => setNewVariants((all) => all.filter((_, j) => j !== i)) : undefined}
                  showStock
                  error={save.error}
                  index={i}
                />
              ))}
            </div>
          </Panel>
        ) : null}
        <SaveBar pending={save.isPending} label={product ? "Save product" : "Create product"} testId="save-product" />
      </form>

      {product ? <VariantsManager product={product} /> : null}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "delete" ? "Delete this product permanently?" : "Archive this product?"}
        body={
          <p>
            {confirm === "delete"
              ? "Only products that were never ordered can be deleted. Ordered products must be archived so order history stays intact."
              : "Archived products disappear from the storefront but remain in order history."}
          </p>
        }
        confirmLabel={confirm === "delete" ? "Delete" : "Archive"}
        pending={lifecycle.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && lifecycle.mutate(confirm)}
      />
    </>
  );
}

function VariantFields({
  draft,
  onChange,
  onRemove,
  showStock,
  lockSku,
  error,
  index,
}: {
  draft: VariantDraft;
  onChange: (d: VariantDraft) => void;
  onRemove?: () => void;
  showStock?: boolean;
  lockSku?: boolean;
  error?: unknown;
  index?: number;
}) {
  const set = (patch: Partial<VariantDraft>) => onChange({ ...draft, ...patch });
  const prefix = index !== undefined ? `variants.${index}` : "";
  return (
    <div className="rounded-[10px] border border-white/10 p-3">
      <div className="grid gap-3 md:grid-cols-4">
        <TextInput label="SKU" value={draft.sku} onChange={(v) => set({ sku: v.toUpperCase() })} required error={fieldError(error, prefix ? `${prefix}.sku` : "sku")} testId="variant-sku" />
        <TextInput label="Price (AMD, VAT incl.)" type="number" min={1} value={draft.price} onChange={(v) => set({ price: v })} required testId="variant-price" />
        <TextInput label="Sale price (optional)" type="number" min={1} value={draft.salePrice} onChange={(v) => set({ salePrice: v })} />
        {showStock ? <TextInput label="Initial stock" type="number" min={0} value={draft.stock} onChange={(v) => set({ stock: v })} testId="variant-stock" /> : <span />}
        <TextInput label="Flavor" value={draft.flavor} onChange={(v) => set({ flavor: v })} />
        <TextInput label="Nicotine (mg/ml)" type="number" min={0} value={draft.nicotineMg} onChange={(v) => set({ nicotineMg: v })} />
        <TextInput label="Volume (ml)" type="number" min={0} value={draft.volumeMl} onChange={(v) => set({ volumeMl: v })} />
        <TextInput label="Color" value={draft.color} onChange={(v) => set({ color: v })} />
      </div>
      <div className="mt-3">
        <LocalizedFields label="Variant label (shown to customers)" value={draft.label} onChange={(label) => set({ label })} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Toggle label="Active" checked={draft.active} onChange={(active) => set({ active })} />
        {lockSku ? <span className="text-xs">SKU cannot be changed after creation.</span> : null}
        {onRemove ? (
          <button type="button" className="text-danger" onClick={onRemove}>
            Remove variant
          </button>
        ) : null}
      </div>
    </div>
  );
}

function draftFrom(v: AdminVariant): VariantDraft {
  const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
  return {
    sku: v.sku,
    label: v.label,
    price: String(v.price),
    salePrice: s(v.salePrice),
    stock: String(v.stock),
    flavor: v.attributes.flavor ?? "",
    nicotineMg: s(v.attributes.nicotineMg),
    volumeMl: s(v.attributes.volumeMl),
    color: v.attributes.color ?? "",
    resistanceOhm: s(v.attributes.resistanceOhm),
    active: v.active,
  };
}

function VariantsManager({ product }: { product: AdminProduct }) {
  const client = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<{ id: string | null; draft: VariantDraft } | null>(null);
  const [adjusting, setAdjusting] = useState<AdminVariant | null>(null);

  const refresh = (saved: AdminProduct) => {
    client.setQueryData(["admin", "product", product.id], saved);
    void client.invalidateQueries({ queryKey: ["admin", "products"] });
  };

  const saveVariant = useMutation({
    mutationFn: async ({ id, draft }: { id: string | null; draft: VariantDraft }) => {
      const common = { label: draft.label, price: Number(draft.price), salePrice: num(draft.salePrice), attributes: attributesOf(draft), active: draft.active };
      if (id) return api<AdminProduct>(`/admin/products/${product.id}/variants/${id}`, { method: "PATCH", body: common });
      return api<AdminProduct>(`/admin/products/${product.id}/variants`, {
        method: "POST",
        body: { ...common, sku: draft.sku.trim(), stock: Number(draft.stock), images: [] },
      });
    },
    onSuccess: (saved) => {
      refresh(saved);
      setEditing(null);
      toast.success("Variant saved.");
    },
    onError: (err) => toast.error(adminErrorText(err)),
  });

  return (
    <Panel
      title="Variants & stock"
      actions={
        <button type="button" className="cus-btn is-sm" onClick={() => setEditing({ id: null, draft: emptyVariant() })} data-testid="add-variant">
          Add variant
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="admin-table min-w-[720px]" data-testid="admin-variants">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Label</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {product.variants.map((v) => (
              <tr key={v.id}>
                <td className="font-mono text-sm text-white">{v.sku}</td>
                <td>{v.label.en || v.label.hy || "—"}</td>
                <td>
                  {formatAmd(v.salePrice ?? v.price)}
                  {v.salePrice ? <del className="ml-2 text-xs">{formatAmd(v.price)}</del> : null}
                </td>
                <td className={v.stock === 0 ? "text-danger" : v.stock <= 5 ? "text-warning" : undefined}>{v.stock}</td>
                <td>{v.active ? "Active" : "Inactive"}</td>
                <td className="whitespace-nowrap text-right">
                  <button type="button" className="text-link mr-3" onClick={() => setAdjusting(v)} data-testid="adjust-stock">
                    Adjust stock
                  </button>
                  <button type="button" className="text-link" onClick={() => setEditing({ id: v.id, draft: draftFrom(v) })}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? (
        <form
          className="mt-4 space-y-3 border-t border-white/10 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!saveVariant.isPending) saveVariant.mutate(editing);
          }}
          data-testid="variant-form"
        >
          <h3 className="font-semibold text-white">{editing.id ? `Edit ${editing.draft.sku}` : "New variant"}</h3>
          {saveVariant.isError ? <AdminError error={saveVariant.error} /> : null}
          <VariantFields
            draft={editing.draft}
            onChange={(draft) => setEditing({ ...editing, draft })}
            showStock={!editing.id}
            lockSku={Boolean(editing.id)}
            error={saveVariant.error}
          />
          <SaveBar pending={saveVariant.isPending} onCancel={() => setEditing(null)} label="Save variant" testId="save-variant" />
        </form>
      ) : null}
      {adjusting ? <StockAdjustDialog product={product} variant={adjusting} onClose={() => setAdjusting(null)} /> : null}
    </Panel>
  );
}

export function StockAdjustDialog({ product, variant, onClose }: { product: { id: string }; variant: AdminVariant; onClose: () => void }) {
  const client = useQueryClient();
  const toast = useToast();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const adjust = useMutation({
    mutationFn: () => api<{ stockBefore: number; stockAfter: number }>("/admin/inventory/adjust", { method: "POST", body: { productId: product.id, variantId: variant.id, delta: Number(delta), reason: reason.trim() } }),
    onSuccess: (r) => {
      toast.success(`Stock ${r.stockBefore} → ${r.stockAfter}`);
      void client.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    },
  });
  return (
    <div className="fixed inset-0 z-[100002] grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="adjust-title">
      <form
        className="w-full max-w-[440px] space-y-4 rounded-[10px] bg-surface p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!adjust.isPending) adjust.mutate();
        }}
        data-testid="stock-adjust-form"
      >
        <h2 id="adjust-title" className="h6 text-white">
          Adjust stock · {variant.sku}
        </h2>
        <p className="text-sm">
          Current stock: <strong className="text-white">{variant.stock}</strong>. Use a positive number to add units and a negative number to remove them. The
          change is applied atomically and can never make stock negative.
        </p>
        {adjust.isError ? <AdminError error={adjust.error} /> : null}
        <TextInput label="Change (e.g. 10 or -2)" type="number" value={delta} onChange={setDelta} required testId="stock-delta" />
        <TextInput label="Reason (audit log)" value={reason} onChange={setReason} required testId="stock-reason" />
        <SaveBar pending={adjust.isPending} onCancel={onClose} label="Apply" testId="apply-stock" />
      </form>
    </div>
  );
}
