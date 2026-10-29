import { handler } from "@/server/http/handler";

export const dynamic = "force-dynamic";

export const POST = handler({}, async (ctx) => {
  await ctx.endSession();
  return { status: 204 };
});
