import "server-only";
import { cookies } from "next/headers";
import type { MfaState, User } from "@/lib/api/types";
import { findValidSession, isPlausibleToken, SESSION_COOKIE } from "./auth/session";
import { userDto } from "./auth/service";
import { mfaStateOf } from "./http/handler";
import { User as UserModel } from "./models";

/** Reads the session cookie in Server Components / layouts. Read-only: never writes cookies. */
export async function getCurrentUser(): Promise<User | null> {
  const ctx = await getAuthContext();
  return ctx.user;
}

export async function getAuthContext(): Promise<{ user: User | null; mfa: MfaState }> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!isPlausibleToken(token)) return { user: null, mfa: "none" };
  try {
    const session = await findValidSession(token);
    if (!session?.userId) return { user: null, mfa: "none" };
    const user = await UserModel.findById(session.userId);
    if (!user || !user.active) return { user: null, mfa: "none" };
    return { user: userDto(user), mfa: mfaStateOf(session, user) };
  } catch {
    return { user: null, mfa: "none" };
  }
}
