import { z } from "zod";
import type { Locale } from "@/lib/api/types";
import { AppError } from "../errors";
import { parseLocale } from "../i18n";
import type { AdminActor } from "../services/admin";
import type { CartOwner } from "../services/cart";
import type { Viewer } from "../services/orders";
import type { Ctx } from "./handler";

export const localeQuery = z.object({ locale: z.enum(["hy", "ru", "en"]).optional() }).passthrough();

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic context accessor
type AnyCtx = Ctx<any, any, any>;

export function localeOf(ctx: AnyCtx): Locale {
  return parseLocale(ctx.req.nextUrl.searchParams.get("locale") ?? undefined);
}

export function viewerOf(ctx: AnyCtx): Viewer {
  return { userId: ctx.user?._id ?? null, sessionHash: ctx.session?.tokenHash ?? null };
}

export function cartOwnerOf(ctx: AnyCtx): CartOwner | null {
  if (ctx.user) return { userId: ctx.user._id };
  if (ctx.session) return { sessionHash: ctx.session.tokenHash };
  return null;
}

export async function ensureCartOwner(ctx: AnyCtx): Promise<CartOwner> {
  if (ctx.user) return { userId: ctx.user._id };
  const session = await ctx.ensureSession();
  return { sessionHash: session.tokenHash };
}

export function adminActorOf(ctx: AnyCtx): AdminActor {
  if (!ctx.user) throw new AppError("UNAUTHENTICATED");
  return { user: ctx.user, requestId: ctx.requestId, ip: ctx.ip };
}

export const emailKey = (ctx: { ip: string; rawBody: unknown }): string => {
  const body = ctx.rawBody as { email?: unknown } | undefined;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  return `${ctx.ip}|${email}`;
};
