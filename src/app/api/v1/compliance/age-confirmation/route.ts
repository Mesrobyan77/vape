import { z } from "zod";
import { handler } from "@/server/http/handler";
import { Session } from "@/server/models";

export const dynamic = "force-dynamic";

const body = z.object({ confirmed: z.literal(true) }).strict();

/**
 * Records the visitor's 18+ self-declaration on the server-side session. Cart mutations and
 * checkout refuse to proceed without it. This is a declaration, not identity verification.
 */
export const POST = handler({ body }, async (ctx) => {
  const session = await ctx.ensureSession();
  if (!session.ageConfirmedAt) {
    const now = new Date();
    await Session.updateOne({ _id: session._id }, { $set: { ageConfirmedAt: now } });
    session.ageConfirmedAt = now;
  }
  return { status: 204 };
});
