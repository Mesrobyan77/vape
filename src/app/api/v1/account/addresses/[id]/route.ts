import { handler, idParam, parseParams } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { addressPatch, deleteAddress, updateAddress } from "@/server/services/addresses";

export const dynamic = "force-dynamic";

export const PATCH = handler<{ id: string }, typeof addressPatch>({ auth: "user", body: addressPatch, rateLimit: [{ rule: LIMITS.account }] }, async (ctx) => {
  const { id } = parseParams(idParam, ctx.params);
  return { data: await updateAddress(ctx.user!, id, ctx.body) };
});

export const DELETE = handler<{ id: string }>({ auth: "user", rateLimit: [{ rule: LIMITS.account }] }, async (ctx) => {
  const { id } = parseParams(idParam, ctx.params);
  return { data: await deleteAddress(ctx.user!, id) };
});
