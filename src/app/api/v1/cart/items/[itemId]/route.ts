import { z } from "zod";
import { AppError } from "@/server/errors";
import { cartOwnerOf, localeOf } from "@/server/http/common";
import { handler, objectId, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { buildCartView, MAX_LINE_QTY, removeItem, updateItem } from "@/server/services/cart";

export const dynamic = "force-dynamic";

const params = z.object({ itemId: objectId });
const body = z.object({ quantity: z.number().int().min(1).max(MAX_LINE_QTY) }).strict();

export const PATCH = handler<{ itemId: string }, typeof body>({ body, requireAge: true, rateLimit: [{ rule: LIMITS.cartWrite }] }, async (ctx) => {
  const { itemId } = parseParams(params, ctx.params);
  const owner = cartOwnerOf(ctx);
  if (!owner) throw new AppError("NOT_FOUND");
  const cart = await updateItem(owner, itemId, ctx.body.quantity);
  return { data: await buildCartView(cart, localeOf(ctx)) };
});

export const DELETE = handler<{ itemId: string }>({ rateLimit: [{ rule: LIMITS.cartWrite }] }, async (ctx) => {
  const { itemId } = parseParams(params, ctx.params);
  const owner = cartOwnerOf(ctx);
  if (!owner) throw new AppError("NOT_FOUND");
  const cart = await removeItem(owner, itemId);
  return { data: await buildCartView(cart, localeOf(ctx)) };
});
