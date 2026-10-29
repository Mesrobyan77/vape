import { Schema, type Types } from "mongoose";
import { defineModel } from "./common";

export interface SessionDoc {
  _id: Types.ObjectId;
  tokenHash: string;
  userId: Types.ObjectId | null;
  role: "customer" | "admin" | null;
  mfaVerified: boolean;
  ageConfirmedAt: Date | null;
  createdAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  /** min(idle, absolute) — drives the TTL cleanup index */
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string;
}

const SessionSchema = new Schema<SessionDoc>({
  tokenHash: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  role: { type: String, enum: ["customer", "admin", null], default: null },
  mfaVerified: { type: Boolean, default: false },
  ageConfirmedAt: { type: Date, default: null },
  createdAt: { type: Date, default: () => new Date() },
  lastSeenAt: { type: Date, default: () => new Date() },
  idleExpiresAt: { type: Date, required: true },
  absoluteExpiresAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  userAgent: { type: String, default: "" },
});

SessionSchema.index({ tokenHash: 1 }, { unique: true });
SessionSchema.index({ userId: 1, revokedAt: 1 });
// TTL cleanup of expired sessions (validity is also checked on every request).
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = defineModel<SessionDoc>("Session", SessionSchema);

export interface PasswordResetDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

const PasswordResetSchema = new Schema<PasswordResetDoc>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  createdAt: { type: Date, default: () => new Date() },
});
PasswordResetSchema.index({ tokenHash: 1 }, { unique: true });
PasswordResetSchema.index({ userId: 1 });
// Remove expired tokens a day after expiry (expired tokens are rejected regardless).
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });

export const PasswordReset = defineModel<PasswordResetDoc>("PasswordReset", PasswordResetSchema);
