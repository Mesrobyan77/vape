"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminBlogPost, AdminImage, Localized } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminError, AdminTable, adminErrorText, emptyLocalized, ImagesEditor, LocalizedFields, PageTitle, Panel, SaveBar, SelectInput, TextInput, useAdminList } from "../ui";
import { formatDateTime } from "./shared";

export function BlogSection({ id }: { id?: string }) {
  if (id === "new") return <BlogEditor />;
  if (id) return <BlogLoader id={id} />;
  return <BlogList />;
}

function BlogList() {
  const [page, setPage] = useState(1);
  const list = useAdminList<AdminBlogPost>("/admin/blog", { page, pageSize: 20 }, "blog");
  return (
    <>
      <PageTitle actions={<Link href="/admin/blog/new" className="cus-btn is-filled is-sm">New post</Link>}>Blog</PageTitle>
      <Panel>
        <AdminTable
          query={list}
          rowKey={(p) => p.id}
          empty="No posts yet."
          onPage={setPage}
          columns={[
            { header: "Title", cell: (p) => <Link href={`/admin/blog/${p.id}`} className="text-white hover:text-primary-2">{p.title.en || p.title.hy}</Link> },
            { header: "Status", cell: (p) => p.status },
            { header: "Published", cell: (p) => formatDateTime(p.publishedAt) },
            { header: "Updated", cell: (p) => formatDateTime(p.updatedAt) },
          ]}
        />
      </Panel>
    </>
  );
}

function BlogLoader({ id }: { id: string }) {
  const list = useAdminList<AdminBlogPost>("/admin/blog", { page: 1, pageSize: 100 }, "blog");
  if (list.isPending) return <div className="skeleton h-[500px]" />;
  if (list.isError) return <AdminError error={list.error} onRetry={() => list.refetch()} />;
  const post = list.data.data.find((p) => p.id === id);
  return post ? <BlogEditor post={post} /> : <p role="alert">Post not found.</p>;
}

function BlogEditor({ post }: { post?: AdminBlogPost }) {
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [title, setTitle] = useState<Localized>(post?.title ?? emptyLocalized());
  const [excerpt, setExcerpt] = useState<Localized>(post?.excerpt ?? emptyLocalized());
  const [body, setBody] = useState<Localized>(post?.body ?? emptyLocalized());
  const [cover, setCover] = useState<AdminImage | null>(post?.coverImage ?? null);
  const [category, setCategory] = useState(post?.category ?? "news");
  const [tags, setTags] = useState(post?.tags.join(", ") ?? "");
  const [readMinutes, setReadMinutes] = useState(String(post?.readMinutes ?? 3));
  const [status, setStatus] = useState<AdminBlogPost["status"]>(post?.status ?? "draft");
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      void client.invalidateQueries({ queryKey: ["admin", "blog"] });
      if (!post) router.push(`/admin/blog/${saved.id}`);
    },
    onError: (err) => toast.error(adminErrorText(err)),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`/admin/blog/${post!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Post deleted.");
      void client.invalidateQueries({ queryKey: ["admin", "blog"] });
      router.push("/admin/blog");
    },
    onError: (err) => {
      setConfirmDelete(false);
      toast.error(adminErrorText(err));
    },
  });

  return (
    <>
      <PageTitle actions={post ? <button type="button" className="cus-btn is-sm is-danger" onClick={() => setConfirmDelete(true)}>Delete</button> : null}>
        {post ? "Edit post" : "New post"}
      </PageTitle>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!save.isPending) save.mutate();
        }}
      >
        {save.isError ? <AdminError error={save.error} /> : null}
        <Panel>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <TextInput label="Slug" value={slug} onChange={setSlug} required />
              <TextInput label="Category (slug)" value={category} onChange={setCategory} />
              <TextInput label="Read minutes" type="number" min={1} value={readMinutes} onChange={setReadMinutes} />
              <SelectInput label="Status" value={status} onChange={(v) => setStatus(v as AdminBlogPost["status"])} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} />
            </div>
            <LocalizedFields label="Title" value={title} onChange={setTitle} required />
            <LocalizedFields label="Excerpt" value={excerpt} onChange={setExcerpt} />
            <LocalizedFields label="Body (plain text; blank line between paragraphs)" value={body} onChange={setBody} multiline />
            <TextInput label="Tags (comma separated)" value={tags} onChange={setTags} />
            <ImagesEditor label="Cover image" images={cover ? [cover] : []} onChange={(imgs) => setCover(imgs[0] ?? null)} max={1} />
          </div>
        </Panel>
        <SaveBar pending={save.isPending} label="Save post" />
      </form>
      <ConfirmDialog open={confirmDelete} title="Delete this post?" pending={remove.isPending} onCancel={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} />
    </>
  );
}
