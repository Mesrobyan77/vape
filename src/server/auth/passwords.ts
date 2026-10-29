import argon2 from "argon2";
import { z } from "zod";

/** NFKC + trim + lowercase. Applied before every user write and lookup. */
export function normalizeEmail(email: string): string {
  return email.normalize("NFKC").trim().toLowerCase();
}

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((e) => normalizeEmail(e));

/**
 * Password policy: 10–128 characters and at least two character classes
 * (lowercase, uppercase, digit, symbol). Long passphrases are encouraged.
 */
export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 10) problems.push("too_short");
  if (password.length > 128) problems.push("too_long");
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 2) problems.push("too_simple");
  return problems;
}

export const passwordSchema = z
  .string()
  .max(128)
  .superRefine((value, ctx) => {
    for (const p of passwordProblems(value)) ctx.addIssue({ code: "custom", message: p });
  });

const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string): Promise<string> => argon2.hash(password, ARGON_OPTS);

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;
/** Equalizes timing for unknown accounts (prevents user enumeration by response time). */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("dummy-password-for-timing-equalization");
  await verifyPassword(await dummyHash, password);
}
