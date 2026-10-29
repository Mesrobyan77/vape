import { handler } from "@/server/http/handler";

export const dynamic = "force-dynamic";

/** Issues a CSRF token bound to the (possibly new, anonymous) session. */
export const GET = handler({}, async (ctx) => ({ data: { csrfToken: await ctx.issueCsrf() } }));
