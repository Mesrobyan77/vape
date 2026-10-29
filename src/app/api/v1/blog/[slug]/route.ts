import { AppError } from "@/server/errors";
import { localeOf } from "@/server/http/common";
import { handler } from "@/server/http/handler";
import { getBlogPost } from "@/server/services/content";

export const dynamic = "force-dynamic";

export const GET = handler<{ slug: string }>({ cache: "public" }, async (ctx) => {
  const post = await getBlogPost(String(ctx.params.slug), localeOf(ctx));
  if (!post) throw new AppError("NOT_FOUND");
  return { data: post };
});
