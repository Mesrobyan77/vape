import type { HydratedDocument, Types } from "mongoose";
import type { Locale, User as UserDto } from "@/lib/api/types";
import { config } from "../config";
import { randomToken, sha256 } from "../crypto";
import { connectDb } from "../db";
import { AppError, isDuplicateKeyError } from "../errors";
import { Order, PasswordReset, User, type UserDoc } from "../models";
import { queueEmail } from "../email/send";
import { burnPasswordCheck, hashPassword, normalizeEmail, verifyPassword } from "./passwords";
import { revokeAllUserSessions } from "./session";

const RESET_TTL_MS = 30 * 60_000;
const ACCOUNT_LOCK_THRESHOLD = 10;
const ACCOUNT_LOCK_MS = 15 * 60_000;

export function userDto(u: Pick<UserDoc, "_id" | "email" | "name" | "phone" | "locale" | "role" | "mfa" | "createdAt">): UserDto {
  return {
    id: String(u._id),
    email: u.email,
    name: u.name,
    phone: u.phone ?? "",
    locale: u.locale,
    role: u.role,
    mfaEnabled: Boolean(u.mfa?.enabled),
    createdAt: u.createdAt.toISOString(),
  };
}

/**
 * Enumeration-safe registration: the caller always answers 202. New accounts get a
 * welcome email; an existing owner gets a notice instead. Role is never client-controlled.
 */
export async function register(input: { email: string; password: string; name: string; locale: Locale }): Promise<{ created: HydratedDocument<UserDoc> | null }> {
  await connectDb();
  const email = normalizeEmail(input.email);
  const existing = await User.findOne({ email });
  if (existing) {
    await burnPasswordCheck(input.password);
    await queueEmail({ to: email, template: "account_exists", locale: input.locale, data: { name: existing.name } }, `account-exists:${email}:${Math.floor(Date.now() / 3_600_000)}`);
    return { created: null };
  }
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await User.create({ email, passwordHash, name: input.name, locale: input.locale, role: "customer" });
    await queueEmail({ to: email, template: "welcome", locale: input.locale, data: { name: user.name } }, `welcome:${String(user._id)}`);
    return { created: user };
  } catch (err) {
    if (isDuplicateKeyError(err)) return { created: null }; // concurrent registration — same generic answer
    throw err;
  }
}

/** Verifies credentials with generic failures, timing equalization and per-account lockout. */
export async function authenticate(emailInput: string, password: string): Promise<HydratedDocument<UserDoc>> {
  await connectDb();
  const email = normalizeEmail(emailInput);
  const user = await User.findOne({ email });
  if (!user || !user.active) {
    await burnPasswordCheck(password);
    throw new AppError("INVALID_CREDENTIALS");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await burnPasswordCheck(password);
    throw new AppError("INVALID_CREDENTIALS");
  }
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await User.updateOne(
      { _id: user._id },
      failed >= ACCOUNT_LOCK_THRESHOLD
        ? { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + ACCOUNT_LOCK_MS) } }
        : { $set: { failedLogins: failed } },
    );
    throw new AppError("INVALID_CREDENTIALS");
  }
  if (user.failedLogins || user.lockedUntil) await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lockedUntil: null } });
  return user;
}

/** Moves guest orders of the previous session to the rotated session (same browser continuity). */
export async function carryGuestOrders(oldHash: string | null, newHash: string): Promise<void> {
  if (!oldHash) return;
  await Order.updateMany({ sessionHash: oldHash, userId: null }, { $set: { sessionHash: newHash } });
}

export async function requestPasswordReset(emailInput: string, locale: Locale): Promise<void> {
  await connectDb();
  const email = normalizeEmail(emailInput);
  const user = await User.findOne({ email, active: true });
  if (!user) return;
  const token = randomToken(32);
  await PasswordReset.create({ userId: user._id, tokenHash: sha256(`reset:${token}`), expiresAt: new Date(Date.now() + RESET_TTL_MS) });
  const resetUrl = `${config().siteUrl}/${locale}/account/reset-password?token=${encodeURIComponent(token)}`;
  await queueEmail({ to: email, template: "password_reset", locale, data: { name: user.name, resetUrl } }, `reset:${sha256(token)}`);
}

/** Consumes a reset token exactly once, sets the password and revokes every session. */
export async function resetPassword(token: string, password: string): Promise<void> {
  await connectDb();
  const tokenHash = sha256(`reset:${token}`);
  const now = new Date();
  const consumed = await PasswordReset.findOneAndUpdate({ tokenHash, usedAt: null, expiresAt: { $gt: now } }, { $set: { usedAt: now } }, { new: true });
  if (!consumed) throw new AppError("VALIDATION_FAILED", "This reset link is invalid or has expired.", [{ path: "token", message: "invalid_or_expired" }]);
  const passwordHash = await hashPassword(password);
  await User.updateOne({ _id: consumed.userId }, { $set: { passwordHash, passwordChangedAt: now, failedLogins: 0, lockedUntil: null } });
  await PasswordReset.updateMany({ userId: consumed.userId, usedAt: null }, { $set: { usedAt: now } });
  await revokeAllUserSessions(consumed.userId);
}

export async function changePassword(user: HydratedDocument<UserDoc>, currentPassword: string, newPassword: string, keepSession: Types.ObjectId | null): Promise<void> {
  const ok = await verifyPassword(user.passwordHash, currentPassword);
  if (!ok) throw new AppError("VALIDATION_FAILED", undefined, [{ path: "currentPassword", message: "incorrect" }]);
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeAllUserSessions(user._id, keepSession ?? undefined);
}
