import { handler } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { addAddress, addressDto, addressInput } from "@/server/services/addresses";

export const dynamic = "force-dynamic";

export const GET = handler({ auth: "user" }, async (ctx) => ({ data: ctx.user!.addresses.map(addressDto) }));

export const POST = handler({ auth: "user", body: addressInput, rateLimit: [{ rule: LIMITS.account }] }, async (ctx) => ({
  status: 201,
  data: await addAddress(ctx.user!, ctx.body),
}));
