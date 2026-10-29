import { randomBytes } from "node:crypto";
import type { HydratedDocument } from "mongoose";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { config } from "../config";
import { decrypt, encrypt, hmacSha256, safeEqual } from "../crypto";
import { AppError } from "../errors";
import { User, type UserDoc } from "../models";

export const TOTP_STEP_SECONDS = 30;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;

const key = () => config().mfaEncryptionKey;

export function hashRecoveryCode(code: string): string {
  return hmacSha256(key(), `recovery:${code.replace(/[\s-]/g, "").toUpperCase()}`);
}

export function generateRecoveryCodes(count = 10): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(10);
    let s = "";
    for (const b of bytes) s += alphabet[b % alphabet.length];
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / TOTP_STEP_SECONDS);

/** Returns the matched time-step for a valid code (±1 step tolerance) or null. */
export function matchTotp(secret: string, token: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(token)) return null;
  for (const delta of [0, -1, 1]) {
    const epoch = Math.floor(now / 1000) + delta * TOTP_STEP_SECONDS;
    const result = verifySync({ secret, token, epoch, period: TOTP_STEP_SECONDS, epochTolerance: 0 });
    if (result.valid) return currentStep(now) + delta;
  }
  return null;
}

export async function startEnrollment(user: HydratedDocument<UserDoc>): Promise<{ otpauthUrl: string; qrDataUrl: string; secret: string }> {
  if (user.mfa.enabled) throw new AppError("CONFLICT", "MFA is already enabled.");
  const secret = generateSecret();
  user.mfa.pendingSecretEnc = encrypt(secret, key());
  await user.save();
  const otpauthUrl = generateURI({ issuer: "Vape Hub Admin", label: user.email, secret, period: TOTP_STEP_SECONDS });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
  return { otpauthUrl, qrDataUrl, secret };
}

function assertNotLocked(user: UserDoc): void {
  if (user.mfa.lockedUntil && user.mfa.lockedUntil > new Date()) throw new AppError("RATE_LIMITED", undefined, { retryAfter: Math.ceil((user.mfa.lockedUntil.getTime() - Date.now()) / 1000) });
}

async function recordFailure(user: HydratedDocument<UserDoc>): Promise<never> {
  const failed = user.mfa.failedAttempts + 1;
  await User.updateOne(
    { _id: user._id },
    { $set: { "mfa.failedAttempts": failed >= MAX_FAILURES ? 0 : failed, "mfa.lockedUntil": failed >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : user.mfa.lockedUntil } },
  );
  throw new AppError("VALIDATION_FAILED", "The code is invalid.", [{ path: "code", message: "invalid" }]);
}

export async function activateEnrollment(user: HydratedDocument<UserDoc>, code: string): Promise<string[]> {
  assertNotLocked(user);
  if (user.mfa.enabled || !user.mfa.pendingSecretEnc) throw new AppError("CONFLICT", "No pending MFA enrollment.");
  const secret = decrypt(user.mfa.pendingSecretEnc, key());
  const step = matchTotp(secret, code);
  if (step === null) return recordFailure(user);
  const codes = generateRecoveryCodes();
  const res = await User.updateOne(
    { _id: user._id, "mfa.enabled": false },
    {
      $set: {
        "mfa.enabled": true,
        "mfa.secretEnc": user.mfa.pendingSecretEnc,
        "mfa.pendingSecretEnc": null,
        "mfa.lastUsedStep": step,
        "mfa.recoveryCodeHashes": codes.map(hashRecoveryCode),
        "mfa.failedAttempts": 0,
        "mfa.lockedUntil": null,
        "mfa.enabledAt": new Date(),
      },
    },
  );
  if (res.modifiedCount !== 1) throw new AppError("CONFLICT");
  return codes;
}

/**
 * Verifies a TOTP code (replay-protected: each time-step is accepted once, via a
 * conditional update on lastUsedStep) or a single-use recovery code.
 */
export async function verifySecondFactor(user: HydratedDocument<UserDoc>, input: { code?: string; recoveryCode?: string }): Promise<"totp" | "recovery"> {
  assertNotLocked(user);
  if (!user.mfa.enabled || !user.mfa.secretEnc) throw new AppError("MFA_REQUIRED", undefined, { mfa: "enroll" });
  if (input.code) {
    const step = matchTotp(decrypt(user.mfa.secretEnc, key()), input.code);
    if (step === null) return recordFailure(user);
    const res = await User.updateOne(
      { _id: user._id, $or: [{ "mfa.lastUsedStep": null }, { "mfa.lastUsedStep": { $lt: step } }] },
      { $set: { "mfa.lastUsedStep": step, "mfa.failedAttempts": 0 } },
    );
    if (res.modifiedCount !== 1) return recordFailure(user); // replayed code
    return "totp";
  }
  if (input.recoveryCode) {
    const hash = hashRecoveryCode(input.recoveryCode);
    const known = user.mfa.recoveryCodeHashes.some((h) => safeEqual(h, hash));
    if (!known) return recordFailure(user);
    // Single-use: the conditional pull only succeeds once.
    const res = await User.updateOne({ _id: user._id, "mfa.recoveryCodeHashes": hash }, { $pull: { "mfa.recoveryCodeHashes": hash }, $set: { "mfa.failedAttempts": 0 } });
    if (res.modifiedCount !== 1) return recordFailure(user);
    return "recovery";
  }
  throw new AppError("VALIDATION_FAILED", undefined, [{ path: "code", message: "required" }]);
}

export async function regenerateRecoveryCodes(user: HydratedDocument<UserDoc>): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await User.updateOne({ _id: user._id }, { $set: { "mfa.recoveryCodeHashes": codes.map(hashRecoveryCode) } });
  return codes;
}

export async function resetMfa(userId: HydratedDocument<UserDoc>["_id"]): Promise<void> {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        "mfa.enabled": false,
        "mfa.secretEnc": null,
        "mfa.pendingSecretEnc": null,
        "mfa.lastUsedStep": null,
        "mfa.recoveryCodeHashes": [],
        "mfa.failedAttempts": 0,
        "mfa.lockedUntil": null,
        "mfa.enabledAt": null,
      },
    },
  );
}

/** Test helper: stores an already-active secret (used by the guarded test endpoint and admin CLI tests). */
export function encryptSecret(secret: string): string {
  return encrypt(secret, key());
}
