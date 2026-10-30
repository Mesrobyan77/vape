"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import type { AdminBrand, AdminCategory, AdminImage, AdminProduct, AdminVariant, Localized, VariantAttributes } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";
import { useToast } from "@/components/providers/Toaster";
import { AdminConfirm, AdminDialog } from "../dialogs";
import {
  AdminError,
  AdminTable,
  adminErrorText,
  Button,
  emptyLocalized,
  fieldError,
  ImagesEditor,
  LocalizedFields,
  PageTitle,
  Panel,
  SaveBar,
  SearchField,
  SelectInput,
  StatusPill,
  TextInput,
  Toolbar,
  Toggle,
  useAdminGet,
  useAdminList,
  useUrlListState,
  type Column,
} from "../ui";
import { ActivePill, formatDateTime, ProductStatusPill } from "./shared";

export function ProductsSection({ id }: { id?: string }) {
  if (id === "new") return <ProductEditor />;
  if (id) return <ProductLoader id={id} />;
  return <ProductsList />;
}

function ProductsList() {
  const defaults = useMemo(() => ({ page: 1, status: "", q: "" }), []);
  const { state, update, reset, isFiltered } = useUrlListState(defaults);
  const list = useAdminList<AdminProduct>(
    "/admin/products",
    { page: state.page, pageSize: 20, q: state.q || undefined, status: state.status || undefined },
    "products",
  );

  const columns: Column<AdminProduct>[] = [
    {
      header: "Product",
      cell: (p) => (
        <span className="adm-rowactions" style={{ gap: "var(--adm-sp-3)", justifyContent: "flex-start" }}>
          {p.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- catalogue thumbnail from the media CDN
            <img src={p.images[0].url} alt="" className="adm-thumb" width={40} height={40} />
          ) : (
            <span className="adm-thumb" aria-hidden />
          )}
          <span>
            <Link href={`/admin/products/${p.id}`} className="adm-cell-title">
              {p.name.en || p.name.hy}
            </Link>
            <span className="adm-cell-sub adm-mono">{p.slug}</span>
          </span>
        </span>
      ),
    },
    { header: "Status", cell: (p) => <ProductStatusPill status={p.status} /> },
    { header: "Variants", cell: (p) => p.variants.length, align: "num", hideBelow: "sm" },
    {
      header: "Stock",
      cell: (p) => {
        const stock = p.variants.reduce((n, v) => n + (v.active ? v.stock : 0), 0);
        return <StatusPill tone={stock === 0 ? "danger" : stock <= 5 ? "warning" : "neutral"}>{stock}</StatusPill>;
      },
      align: "num",
    },
    { header: "From", cell: (p) => <span className="adm-money">{formatAmd(p.minPrice)}</span>, align: "num", hideBelow: "md" },
    { header: "Sales", cell: (p) => p.salesCount, align: "num", hideBelow: "lg" },
    { header: "Featured", cell: (p) => (p.featured ? <StatusPill tone="accent">Featured</StatusPill> : <span className="adm-cell-sub">—</span>), hideBelow: "lg" },
    {
      header: "Actions",
      align: "actions",
      cell: (p) => (
        <span className="adm-rowactions" style={{ justifyContent: "flex-end" }}>
          <Link href={`/admin/products/${p.id}`} className="adm-linkbtn">
            <Pencil aria-hidden /> Edit
          </Link>
          <a href={`/hy/products/${p.slug}`} target="_blank" rel="noreferrer" className="adm-linkbtn is-muted" title="Open in the storefront">
            <ExternalLink aria-hidden /> View
          </a>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageTitle
        description="Devices, pods and liquids shown in the storefront, with their variants and prices."
        actions={
          <Link href="/admin/products/new" className="adm-btn is-primary" data-testid="new-product">
            <Plus aria-hidden /> New product
          </Link>
        }
      >
        Products
      </PageTitle>
      <Panel flush>
        <Toolbar>
          <SearchField label="Search" value={state.q} placeholder="Name, slug or SKU" testId="products-search" onSubmit={(q) => update({ q, page: 1 })} />
          <SelectInput
            label="Status"
            className="md:w-44"
            value={state.status}
            onChange={(status) => update({ status, page: 1 })}
            testId="products-status"
            options={[
              { value: "", label: "All" },
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
              { value: "archived", label: "Archived" },
            ]}
          />
          {isFiltered ? (
            <Button variant="quiet" onClick={reset} data-testid="products-clear">
              Clear filters
            </Button>
          ) : null}
        </Toolbar>
        <AdminTable
          testId="admin-products"
          query={list}
          rowKey={(p) => p.id}
          columns={columns}
          caption="Products"
          onPage={(page) => update({ page })}
          empty={isFiltered ? "No products match these filters." : "No products yet."}
          emptyBody={isFiltered ? "Adjust the status filter or clear the search to see more." : "Create your first product to start selling."}
          emptyAction={
            isFiltered ? (
              <Button onClick={reset}>Clear filters</Button>
            ) : (
              <Link href="/admin/products/new" className="adm-btn is-primary">
                <Plus aria-hidden /> New product
              </Link>
            )
          }
        />
      </Panel>
    </>
  );
}

function ProductLoader({ id }: { id: string }) {
  const q = useAdminGet<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`, ["product", id]);
  if (q.isPending) {
    return (
      <>
        <div className="adm-skeleton mb-4 h-7 w-64" aria-busy="true" />
        <div className="adm-stack">
          <div className="adm-skeleton h-[320px]" />
          <div className="adm-skeleton h-[220px]" />
        </div>
      </>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="adm-stack">
        <Link href="/admin/products" className="adm-linkbtn">
          Back to products
        </Link>
        <AdminError error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      </div>
    );
  }
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

  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({
      slug: product?.slug ?? "",
      name: product?.name ?? emptyLocalized(),
      shortDescription: product?.shortDescription ?? emptyLocalized(),
      description: product?.description ?? emptyLocalized(),
      brandId: product?.brandId ?? "",
      categoryId: product?.categoryId ?? "",
      tags: product?.tags.join(", ") ?? "",
      images: product?.images ?? [],
      status: product?.status ?? "draft",
      featured: product?.featured ?? false,
      warning: product?.warnings[0] ?? emptyLocalized(),
      seoTitle: product?.seo.title ?? emptyLocalized(),
      seoDescription: product?.seo.description ?? emptyLocalized(),
    }),
  );
  const current = JSON.stringify({ slug, name, shortDescription, description, brandId, categoryId, tags, images, status, featured, warning, seoTitle, seoDescription });
  const dirty = current !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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
      setBaseline(JSON.stringify({
        slug: saved.slug,
        name: saved.name,
        shortDescription: saved.shortDescription,
        description: saved.description,
        brandId: saved.brandId ?? "",
        categoryId: saved.categoryId ?? "",
        tags: saved.tags.join(", "),
        images: saved.images,
        status: saved.status,
        featured: saved.featured,
        warning: saved.warnings[0] ?? emptyLocalized(),
        seoTitle: saved.seo.title,
        seoDescription: saved.seo.description,
      }));
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
      setBaseline(current);
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
        description={product ? `Slug ${product.slug} · updated ${formatDateTime(product.updatedAt ?? null)}` : "Add a product and its variants in one step."}
        actions={
          product ? (
            <>
              <a href={`/hy/products/${product.slug}`} target="_blank" rel="noreferrer" className="adm-btn">
                <ExternalLink aria-hidden /> View in store
              </a>
              <Button onClick={() => setConfirm("archive")} disabled={product.status === "archived"}>
                Archive
              </Button>
              <Button variant="danger" onClick={() => setConfirm("delete")} data-testid="delete-product">
                <Trash2 aria-hidden /> Delete
              </Button>
            </>
          ) : null
        }
      >
        {product ? product.name.en || product.name.hy : "New product"}
      </PageTitle>

      <form onSubmit={submit} data-testid="product-form">
        <div className="adm-stack">
          {save.isError ? <AdminError error={save.error} /> : null}
          <Panel title="Basics" subtitle="How the product is identified and listed">
            <div className="adm-stack">
              <div className="adm-grid md:grid-cols-3">
                <TextInput label="Slug" value={slug} onChange={setSlug} required error={fieldError(save.error, "slug")} testId="product-slug" mono hint="Used in the storefront URL." />
                <SelectInput
                  label="Status"
                  value={status}
                  onChange={(v) => setStatus(v as AdminProduct["status"])}
                  options={[
                    { value: "draft", label: "Draft (hidden)" },
                    { value: "active", label: "Active (visible)" },
                    { value: "archived", label: "Archived" },
                  ]}
                  testId="product-status"
                />
                <div className="adm-field" style={{ justifyContent: "flex-end" }}>
                  <span className="adm-label" aria-hidden>
                    Merchandising
                  </span>
                  <Toggle label="Featured on homepage" checked={featured} onChange={setFeatured} testId="product-featured" />
                </div>
              </div>
              <LocalizedFields label="Name" value={name} onChange={setName} required error={fieldError(save.error, "name")} testId="product-name" />
              <LocalizedFields label="Short description" value={shortDescription} onChange={setShort} hint="One line, shown on cards and in search results." />
              <LocalizedFields label="Description" value={description} onChange={setDescription} multiline hint="Plain text; a blank line starts a new paragraph." />
              <div className="adm-grid md:grid-cols-3">
                <SelectInput
                  label="Category"
                  value={categoryId}
                  onChange={setCategoryId}
                  options={[{ value: "", label: "— none —" }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name.en || c.name.hy }))]}
                />
                <SelectInput label="Brand" value={brandId} onChange={setBrandId} options={[{ value: "", label: "— none —" }, ...(brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))]} />
                <TextInput label="Tags" value={tags} onChange={setTags} hint="Comma separated." />
              </div>
            </div>
          </Panel>
          <Panel title="Images" subtitle="First image is the cover">
            <ImagesEditor label="Product gallery" images={images} onChange={setImages} />
          </Panel>
          <Panel title="Compliance & SEO" subtitle="Nicotine warning and search-engine presentation">
            <div className="adm-stack">
              <LocalizedFields label="Mandatory warning" value={warning} onChange={setWarning} multiline hint="Shown next to the add-to-cart button. Leave all three empty to hide." />
              <LocalizedFields label="SEO title" value={seoTitle} onChange={setSeoTitle} hint="Falls back to the product name when empty." />
              <LocalizedFields label="SEO description" value={seoDescription} onChange={setSeoDescription} hint="Falls back to the short description when empty." />
            </div>
          </Panel>
          {!product ? (
            <Panel
              title="Variants"
              subtitle="At least one variant is required to sell the product"
              actions={
                <Button onClick={() => setNewVariants((v) => [...v, emptyVariant()])}>
                  <Plus aria-hidden /> Add variant
                </Button>
              }
            >
              <div className="adm-stack">
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
          <SaveBar pending={save.isPending} label={product ? "Save product" : "Create product"} testId="save-product" dirty={dirty} hint="Nothing to save yet" />
        </div>
      </form>

      {product ? <VariantsManager product={product} /> : null}

      <AdminConfirm
        open={confirm !== null}
        title={confirm === "delete" ? "Delete this product permanently?" : "Archive this product?"}
        body={
          <p className="adm-hint">
            {confirm === "delete"
              ? "Only products that were never ordered can be deleted. Ordered products must be archived so order history stays intact."
              : "Archived products disappear from the storefront but remain in order history."}
          </p>
        }
        confirmLabel={confirm === "delete" ? "Delete" : "Archive"}
        danger={confirm === "delete"}
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
    <div className="adm-fieldset">
      <legend>{draft.sku || `Variant${index !== undefined ? ` ${index + 1}` : ""}`}</legend>
      <div className="adm-grid md:grid-cols-4">
        <TextInput label="SKU" value={draft.sku} onChange={(v) => set({ sku: v.toUpperCase() })} required mono disabled={lockSku} error={fieldError(error, prefix ? `${prefix}.sku` : "sku")} testId="variant-sku" />
        <TextInput label="Price (AMD, VAT incl.)" type="number" min={1} inputMode="numeric" value={draft.price} onChange={(v) => set({ price: v })} required testId="variant-price" />
        <TextInput label="Sale price (optional)" type="number" min={1} inputMode="numeric" value={draft.salePrice} onChange={(v) => set({ salePrice: v })} />
        {showStock ? <TextInput label="Initial stock" type="number" min={0} inputMode="numeric" value={draft.stock} onChange={(v) => set({ stock: v })} testId="variant-stock" /> : <span />}
        <TextInput label="Flavor" value={draft.flavor} onChange={(v) => set({ flavor: v })} />
        <TextInput label="Nicotine (mg/ml)" type="number" min={0} inputMode="numeric" value={draft.nicotineMg} onChange={(v) => set({ nicotineMg: v })} />
        <TextInput label="Volume (ml)" type="number" min={0} inputMode="numeric" value={draft.volumeMl} onChange={(v) => set({ volumeMl: v })} />
        <TextInput label="Colour" value={draft.color} onChange={(v) => set({ color: v })} />
      </div>
      <div style={{ marginTop: "var(--adm-sp-3)" }}>
        <LocalizedFields label="Variant label (shown to customers)" value={draft.label} onChange={(label) => set({ label })} />
      </div>
      <div className="adm-rowactions" style={{ justifyContent: "space-between", marginTop: "var(--adm-sp-3)", gap: "var(--adm-sp-3)" }}>
        <Toggle label="Active" checked={draft.active} onChange={(active) => set({ active })} />
        {lockSku ? <span className="adm-hint">The SKU cannot be changed after creation.</span> : null}
        {onRemove ? (
          <Button variant="quiet" onClick={onRemove}>
            <Trash2 aria-hidden /> Remove variant
          </Button>
        ) : null}
      </div>
    </div>
  );
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
    <div className="adm-stack" style={{ marginTop: "var(--adm-sp-4)" }}>
      <Panel
        title="Variants & stock"
        subtitle="Prices include VAT. Stock changes must be adjusted with a reason so they are audit-logged."
        flush
        actions={
          <Button variant="primary" size="sm" onClick={() => setEditing({ id: null, draft: emptyVariant() })} data-testid="add-variant">
            <Plus aria-hidden /> Add variant
          </Button>
        }
      >
        <div className="adm-tablewrap">
          <table className="adm-table" data-testid="admin-variants">
            <caption className="sr-only">Variants of this product</caption>
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">Label</th>
                <th scope="col" className="is-num">
                  Price
                </th>
                <th scope="col" className="is-num">
                  Stock
                </th>
                <th scope="col">Status</th>
                <th scope="col" className="is-actions">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((v) => (
                <tr key={v.id}>
                  <td className="adm-mono">{v.sku}</td>
                  <td>
                    <span className="adm-cell-strong">{v.label.en || v.label.hy || "—"}</span>
                    {v.attributes.flavor ? <span className="adm-cell-sub">{v.attributes.flavor}</span> : null}
                  </td>
                  <td className="is-num">
                    <span className="adm-money adm-cell-strong">{formatAmd(v.salePrice ?? v.price)}</span>
                    {v.salePrice ? <span className="adm-cell-sub" style={{ textDecoration: "line-through" }}>{formatAmd(v.price)}</span> : null}
                  </td>
                  <td className="is-num">
                    <StatusPill tone={v.stock === 0 ? "danger" : v.stock <= 5 ? "warning" : "neutral"}>{v.stock}</StatusPill>
                  </td>
                  <td>
                    <ActivePill active={v.active} />
                  </td>
                  <td className="is-actions">
                    <span className="adm-rowactions" style={{ justifyContent: "flex-end" }}>
                      <Button size="sm" onClick={() => setAdjusting(v)} data-testid="adjust-stock">
                        Adjust stock
                      </Button>
                      <Button size="sm" variant="quiet" onClick={() => setEditing({ id: v.id, draft: draftFrom(v) })}>
                        <Pencil aria-hidden /> Edit
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {product.variants.length === 0 ? <p className="adm-hint p-5">No variants yet — add one so customers can buy this product.</p> : null}
      </Panel>

      <AdminDialog
        open={editing !== null}
        wide
        title={editing?.id ? `Edit ${editing.draft.sku}` : "New variant"}
        description={editing?.id ? "Price, label and attributes. Stock is changed with “Adjust stock” so every movement is audit-logged." : "Create the variant with its initial stock."}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setEditing(null)} disabled={saveVariant.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => editing && saveVariant.mutate(editing)}
              disabled={saveVariant.isPending || !editing}
              aria-busy={saveVariant.isPending}
              data-testid="save-variant"
            >
              {saveVariant.isPending ? "Saving…" : "Save variant"}
            </Button>
          </>
        }
      >
        {saveVariant.isError ? <AdminError error={saveVariant.error} /> : null}
        {editing ? (
          <div data-testid="variant-form">
            <VariantFields
              draft={editing.draft}
              onChange={(draft) => setEditing({ ...editing, draft })}
              showStock={!editing.id}
              lockSku={Boolean(editing.id)}
              error={saveVariant.error}
            />
          </div>
        ) : null}
      </AdminDialog>

      {adjusting ? <StockAdjustDialog product={product} variant={adjusting} onClose={() => setAdjusting(null)} /> : null}
    </div>
  );
}

export function StockAdjustDialog({ product, variant, onClose }: { product: { id: string }; variant: { id: string; sku: string; stock: number }; onClose: () => void }) {
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
    onError: (err) => toast.error(adminErrorText(err)),
  });

  const quick = (n: number) => `${n > 0 ? "+" : ""}${n}`;

  return (
    <AdminDialog
      open
      testId="stock-adjust-form"
      title={`Adjust stock · ${variant.sku}`}
      description={`Current stock is ${variant.stock}. The change is applied atomically and can never make stock negative.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={adjust.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="stock-adjust-inputs"
            variant="primary"
            disabled={adjust.isPending || !delta.trim() || !reason.trim()}
            aria-busy={adjust.isPending}
            data-testid="apply-stock"
          >
            {adjust.isPending ? "Applying…" : "Apply change"}
          </Button>
        </>
      }
    >
      <form
        id="stock-adjust-inputs"
        onSubmit={(e) => {
          e.preventDefault();
          if (!adjust.isPending && delta.trim() !== "" && reason.trim()) adjust.mutate();
        }}
        className="adm-stack"
      >
        {adjust.isError ? <AdminError error={adjust.error} /> : null}
        <div className="adm-rowactions" style={{ gap: "var(--adm-sp-2)" }}>
          {[-5, -1, 1, 5, 10].map((n) => (
            <Button key={n} size="sm" onClick={() => setDelta(String(n))} aria-label={`Set change to ${quick(n)}`}>
              {quick(n)}
            </Button>
          ))}
        </div>
        <TextInput label="Change (e.g. 10 or -2)" type="number" value={delta} onChange={setDelta} required inputMode="numeric" hint="Positive adds units, negative removes them." testId="stock-delta" />
        <TextInput label="Reason (written to the audit log)" value={reason} onChange={setReason} required placeholder="Delivery received / damaged unit / stock count…" testId="stock-reason" />
      </form>
    </AdminDialog>
  );
}
