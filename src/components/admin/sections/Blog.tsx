"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import type { AdminBlogPost, AdminImage, Localized } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { AdminConfirm } from "../dialogs";
import {
  AdminError,
  AdminTable,
  adminErrorText,
  Button,
  EmptyState,
  ImagesEditor,
  LocalizedFields,
  PageTitle,
  Panel,
  SaveBar,
  SelectInput,
  StatusPill,
  TextInput,
  useAdminList,
  useUrlListState,
  type Column,
} from "../ui";
import { formatDateTime } from "./shared";

export function BlogSection({ id }: { id?: string }) {
  if (id === "new") return <BlogEditor />;
  if (id) return <BlogLoader id={id} />;
  return <BlogList />;
}

function BlogList() {
  const defaults = useMemo(() => ({ page: 1 }), []);
  const { state, update } = useUrlListState(defaults);
  const list = useAdminList<AdminBlogPost>("/admin/blog", { page: state.page, pageSize: 20 }, "blog");

  const columns: Column<AdminBlogPost>[] = [
    {
      header: "Post",
      cell: (p) => (
        <>
          <Link href={`/admin/blog/${p.id}`} className="adm-cell-title">
            {p.title.en || p.title.hy}
          </Link>
          <span className="adm-cell-sub adm-mono">{p.slug}</span>
        </>
      ),
    },
    {
      header: "Status",
      cell: (p) => <StatusPill tone={p.status === "published" ? "success" : "warning"}>{p.status}</StatusPill>,
    },
    { header: "Category", cell: (p) => <StatusPill tone="neutral" dot={false}>{p.category}</StatusPill>, hideBelow: "sm" },
    { header: "Published", cell: (p) => formatDateTime(p.publishedAt), hideBelow: "md" },
    { header: "Updated", cell: (p) => formatDateTime(p.updatedAt), hideBelow: "lg" },
    {
      header: "Actions",
      align: "actions",
      cell: (p) =>
        p.status === "published" ? (
          <a href={`/hy/blog/${p.slug}`} target="_blank" rel="noreferrer" className="adm-linkbtn is-muted">
            <ExternalLink aria-hidden /> View
          </a>
        ) : (
          <span className="adm-cell-sub">draft</span>
        ),
    },
  ];

  return (
    <>
      <PageTitle
        description="Articles shown in the storefront blog. Drafts stay hidden until you publish them."
        actions={
          <Link href="/admin/blog/new" className="adm-btn is-primary" data-testid="new-post">
            <Plus aria-hidden /> New post
          </Link>
        }
      >
        Blog
      </PageTitle>
      <Panel flush>
        <AdminTable
          testId="admin-blog"
          query={list}
          rowKey={(p) => p.id}
          columns={columns}
          caption="Blog posts"
          onPage={(page) => update({ page })}
          empty="No posts yet."
          emptyBody="Publish an article to give the storefront fresh news and buying guides."
          emptyAction={
            <Link href="/admin/blog/new" className="adm-btn is-primary">
              <Plus aria-hidden /> New post
            </Link>
          }
        />
      </Panel>
    </>
  );
}

function BlogLoader({ id }: { id: string }) {
  // There is no single-post admin endpoint, so the editor reads the list it came from.
  const list = useAdminList<AdminBlogPost>("/admin/blog", { page: 1, pageSize: 100 }, "blog-lookup");
  if (list.isPending) {
    return (
      <>
        <div className="adm-skeleton mb-4 h-7 w-48" aria-busy="true" />
        <div className="adm-skeleton h-[420px]" />
      </>
    );
  }
  if (list.isError) {
    return (
      <div className="adm-stack">
        <Link href="/admin/blog" className="adm-linkbtn">
          Back to posts
        </Link>
        <AdminError error={list.error} onRetry={() => list.refetch()} retrying={list.isFetching} />
      </div>
    );
  }
  const post = list.data?.data.find((p) => p.id === id);
  if (post) return <BlogEditor post={post} />;
  return (
    <Panel>
      <EmptyState
        title="This post is not in the first 100 posts"
        body="The admin API has no single-post endpoint, so the editor can only open posts returned by the first list page. Search the list to find it, or add a GET /admin/blog/{id} endpoint."
        action={
          <Link href="/admin/blog" className="adm-btn is-primary">
            Back to posts
          </Link>
        }
      />
    </Panel>
  );
}

function BlogEditor({ post }: { post?: AdminBlogPost }) {
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [title, setTitle] = useState<Localized>(post?.title ?? { hy: "", ru: "", en: "" });
  const [excerpt, setExcerpt] = useState<Localized>(post?.excerpt ?? { hy: "", ru: "", en: "" });
  const [body, setBody] = useState<Localized>(post?.body ?? { hy: "", ru: "", en: "" });
  const [cover, setCover] = useState<AdminImage | null>(post?.coverImage ?? null);
  const [category, setCategory] = useState(post?.category ?? "news");
  const [tags, setTags] = useState(post?.tags.join(", ") ?? "");
  const [readMinutes, setReadMinutes] = useState(String(post?.readMinutes ?? 3));
  const [status, setStatus] = useState<AdminBlogPost["status"]>(post?.status ?? "draft");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [baseline, setBaseline] = useState(() => JSON.stringify({ slug: post?.slug ?? "", title: post?.title, excerpt: post?.excerpt, body: post?.body, cover: post?.coverImage ?? null, category: post?.category ?? "news", tags: post?.tags.join(", ") ?? "", readMinutes: String(post?.readMinutes ?? 3), status: post?.status ?? "draft" }));
  const current = JSON.stringify({ slug, title, excerpt, body, cover, category, tags, readMinutes, status });
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
    mutationFn: () => {
      const payload = {
        slug: slug.trim(),
        title,
        excerpt,
        body,
        coverImage: cover,
        category: category.trim() || "news",
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        readMinutes: Number(readMinutes) || 3,
        status,
        publishedAt: status === "published" ? (post?.publishedAt ?? new Date().toISOString()) : null,
      };
      return post ? api<AdminBlogPost>(`/admin/blog/${post.id}`, { method: "PATCH", body: payload }) : api<AdminBlogPost>("/admin/blog", { method: "POST", body: payload });
    },
    onSuccess: (saved) => {
      toast.success("Post saved.");
      setBaseline(JSON.stringify({
        slug: saved.slug,
        title: saved.title,
        excerpt: saved.excerpt,
        body: saved.body,
        cover: saved.coverImage,
        category: saved.category,
        tags: saved.tags.join(", "),
        readMinutes: String(saved.readMinutes),
        status: saved.status,
      }));
      void client.invalidateQueries({ queryKey: ["admin", "blog"] });
      if (!post) router.push(`/admin/blog/${saved.id}`);
    },
    onError: (err) => toast.error(adminErrorText(err)),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`/admin/blog/${post!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Post deleted.");
      setBaseline(current);
      void client.invalidateQueries({ queryKey: ["admin", "blog"] });
      router.push("/admin/blog");
    },
    onError: (err) => {
      setConfirmDelete(false);
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
        description={post ? `Slug ${post.slug} · updated ${formatDateTime(post.updatedAt)}` : "Write an article in all three storefront languages."}
        actions={
          post ? (
            <>
              {post.status === "published" ? (
                <a href={`/hy/blog/${post.slug}`} target="_blank" rel="noreferrer" className="adm-btn">
                  <ExternalLink aria-hidden /> View in store
                </a>
              ) : null}
              <Button variant="danger" onClick={() => setConfirmDelete(true)} data-testid="delete-post">
                <Trash2 aria-hidden /> Delete
              </Button>
            </>
          ) : null
        }
      >
        {post ? title.en || title.hy || "Edit post" : "New post"}
      </PageTitle>

      <form onSubmit={submit} data-testid="blog-form">
        <div className="adm-stack">
          {save.isError ? <AdminError error={save.error} /> : null}
          <div className="adm-grid lg:grid-cols-3">
            <div className="adm-stack lg:col-span-2">
              <Panel title="Content">
                <div className="adm-stack">
                  <LocalizedFields label="Title" value={title} onChange={setTitle} required />
                  <LocalizedFields label="Excerpt" value={excerpt} onChange={setExcerpt} hint="Shown in the post list and link previews." />
                  <LocalizedFields label="Body" value={body} onChange={setBody} multiline hint="Plain text; a blank line starts a new paragraph." />
                </div>
              </Panel>
              <Panel title="Cover image" subtitle="Used in the post list and at the top of the article">
                <ImagesEditor label="Cover" images={cover ? [cover] : []} onChange={(imgs) => setCover(imgs[0] ?? null)} max={1} />
              </Panel>
            </div>
            <Panel title="Publishing">
              <div className="adm-stack">
                <TextInput label="Slug" value={slug} onChange={setSlug} required mono hint="Part of the article URL." />
                <SelectInput
                  label="Status"
                  value={status}
                  onChange={(v) => setStatus(v as AdminBlogPost["status"])}
                  options={[
                    { value: "draft", label: "Draft (hidden)" },
                    { value: "published", label: "Published" },
                  ]}
                  testId="blog-status"
                />
                <TextInput label="Category" value={category} onChange={setCategory} hint="Matches the storefront blog filter." />
                <TextInput label="Read time (minutes)" type="number" min={1} inputMode="numeric" value={readMinutes} onChange={setReadMinutes} />
                <TextInput label="Tags" value={tags} onChange={setTags} hint="Comma separated." />
              </div>
            </Panel>
          </div>
          <SaveBar pending={save.isPending} label="Save post" testId="save-post" dirty={dirty} hint="Nothing to save yet" />
        </div>
      </form>

      <AdminConfirm
        open={confirmDelete}
        title="Delete this post?"
        body={<p className="adm-hint">The article disappears from the storefront immediately. This cannot be undone.</p>}
        confirmLabel="Delete post"
        pending={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
