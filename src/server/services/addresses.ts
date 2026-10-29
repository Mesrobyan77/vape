import { z } from "zod";
import type { HydratedDocument } from "mongoose";
import type { Address } from "@/lib/api/types";
import { REGION_CODES } from "@/lib/pricing";
import { AppError } from "../errors";
import type { AddressDoc, UserDoc } from "../models";

export const MAX_ADDRESSES = 10;

export const addressInput = z
  .object({
    label: z.string().trim().max(40).default(""),
    fullName: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(6).max(24).regex(/^[+\d\s()-]+$/, "Invalid phone"),
    region: z.enum(REGION_CODES),
    city: z.string().trim().min(1).max(80),
    line1: z.string().trim().min(3).max(200),
    line2: z.string().trim().max(200).default(""),
    notes: z.string().trim().max(500).default(""),
    isDefault: z.boolean().default(false),
  })
  .strict();

export const addressPatch = addressInput.partial().strict();

export const addressDto = (a: AddressDoc): Address => ({
  id: String(a._id),
  label: a.label,
  fullName: a.fullName,
  phone: a.phone,
  region: a.region,
  city: a.city,
  line1: a.line1,
  line2: a.line2,
  notes: a.notes,
  isDefault: a.isDefault,
});

function normalizeDefault(user: HydratedDocument<UserDoc>, defaultId?: string): void {
  if (defaultId) for (const a of user.addresses) a.isDefault = String(a._id) === defaultId;
  if (user.addresses.length && !user.addresses.some((a) => a.isDefault)) user.addresses[0]!.isDefault = true;
}

/** All address operations are scoped to the authenticated user's own document. */
export async function addAddress(user: HydratedDocument<UserDoc>, input: z.output<typeof addressInput>): Promise<Address[]> {
  if (user.addresses.length >= MAX_ADDRESSES) throw new AppError("VALIDATION_FAILED", undefined, [{ path: "addresses", message: `max ${MAX_ADDRESSES}` }]);
  user.addresses.push(input);
  const created = user.addresses[user.addresses.length - 1]!;
  normalizeDefault(user, input.isDefault ? String(created._id) : undefined);
  await user.save();
  return user.addresses.map(addressDto);
}

export async function updateAddress(user: HydratedDocument<UserDoc>, id: string, input: z.output<typeof addressPatch>): Promise<Address[]> {
  const addr = user.addresses.id(id);
  if (!addr) throw new AppError("NOT_FOUND");
  addr.set({ ...input });
  normalizeDefault(user, input.isDefault ? id : undefined);
  await user.save();
  return user.addresses.map(addressDto);
}

export async function deleteAddress(user: HydratedDocument<UserDoc>, id: string): Promise<Address[]> {
  const addr = user.addresses.id(id);
  if (!addr) throw new AppError("NOT_FOUND");
  user.addresses.pull({ _id: addr._id });
  normalizeDefault(user);
  await user.save();
  return user.addresses.map(addressDto);
}
