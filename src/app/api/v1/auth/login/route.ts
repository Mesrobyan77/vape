import { z } from "zod";
import { authenticate, carryGuestOrders, userDto } from "@/server/auth/service";
import { emailKey } from "@/server/http/common";
import { handler, mfaStateOf } from "@/server/http/handler";
import { LIMITS } from "@/server/http/rate-limit";
import { mergeGuestCart } from "@/server/services/cart";
import { audit } from "@/server/services/audit";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().max(254), password: z.string().min(1).max(128) }).strict();

export const POST = handler(
  { body, rateLimit: [{ rule: LIMITS.loginIp }, { rule: LIMITS.loginAccount, key: emailKey }] },
  async (ctx) => {
    const user = await authenticate(ctx.body.email, ctx.body.password);
    const previousHash = ctx.session?.tokenHash ?? null;
    // Session fixation defence: always issue a new session id on login.
    const { session, csrfToken } = await ctx.rotateSession({ userId: user._id, role: user.role, mfaVerified: false });
    if (previousHash) {
      await mergeGuestCart(previousHash, user._id);
      await carryGuestOrders(previousHash, session.tokenHash);
    }
    if (user.role === "admin") {
      await audit({ actorId: user._id, actorEmail: user.email, action: "admin.login", targetType: "user", targetId: String(user._id), requestId: ctx.requestId, ip: ctx.ip });
    }
    return { data: { user: userDto(user), csrfToken, mfa: mfaStateOf(session, user) } };
  },
);
