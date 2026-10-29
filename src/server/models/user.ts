import { Schema, type Types } from "mongoose";
import type { Locale, Role } from "@/lib/api/types";
import { defineModel } from "./common";

export interface AddressDoc {
  _id: Types.ObjectId;
  label: string;
  fullName: string;
  phone: string;
  region: string;
  city: string;
  line1: string;
  line2: string;
  notes: string;
  isDefault: boolean;
}

export interface MfaState {
  enabled: boolean;
  secretEnc: string | null;
  pendingSecretEnc: string | null;
  lastUsedStep: number | null;
  recoveryCodeHashes: string[];
  failedAttempts: number;
  lockedUntil: Date | null;
  enabledAt: Date | null;
}

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  phone: string;
  locale: Locale;
  role: Role;
  active: boolean;
  addresses: Types.DocumentArray<AddressDoc>;
  mfa: MfaState;
  failedLogins: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<AddressDoc>({
  label: { type: String, default: "" },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  region: { type: String, required: true },
  city: { type: String, required: true },
  line1: { type: String, required: true },
  line2: { type: String, default: "" },
  notes: { type: String, default: "" },
  isDefault: { type: Boolean, default: false },
});

const UserSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    locale: { type: String, enum: ["hy", "ru", "en"], default: "hy" },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    active: { type: Boolean, default: true },
    addresses: { type: [AddressSchema], default: [] },
    mfa: {
      enabled: { type: Boolean, default: false },
      secretEnc: { type: String, default: null },
      pendingSecretEnc: { type: String, default: null },
      lastUsedStep: { type: Number, default: null },
      recoveryCodeHashes: { type: [String], default: [] },
      failedAttempts: { type: Number, default: 0 },
      lockedUntil: { type: Date, default: null },
      enabledAt: { type: Date, default: null },
    },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Unique normalized email (the application normalizes before every write and query).
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1, createdAt: -1 });

export const User = defineModel<UserDoc>("User", UserSchema);
