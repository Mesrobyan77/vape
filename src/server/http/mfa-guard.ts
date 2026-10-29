import { AppError } from "../errors";
import type { Ctx } from "./handler";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic context accessor
type AnyCtx = Ctx<any, any, any>;

/** MFA endpoints are only meaningful for administrators (customers have no second factor). */
export function requireAdminUser(ctx: AnyCtx) {
  const user = ctx.user;
  if (!user || !ctx.session) throw new AppError("UNAUTHENTICATED");
  if (user.role !== "admin") throw new AppError("FORBIDDEN");
  return user;
}
