import { z } from "zod";

/** Mirrors the server password policy (server remains authoritative). */
export function isStrongPassword(value: string): boolean {
  if (value.length < 10 || value.length > 128) return false;
  const hasLetter = /\p{L}/u.test(value);
  const hasOther = /[\d\p{P}\p{S}]/u.test(value);
  return hasLetter && hasOther;
}

export type AuthMessages = {
  required: string;
  email: string;
  passwordWeak: string;
  mismatch: string;
  max: (max: number) => string;
};

export const loginSchema = (m: AuthMessages) =>
  z.object({
    email: z.string().trim().min(1, m.required).email(m.email),
    password: z.string().min(1, m.required).max(128, m.max(128)),
  });

export const registerSchema = (m: AuthMessages) =>
  z
    .object({
      name: z.string().trim().min(1, m.required).max(80, m.max(80)),
      email: z.string().trim().min(1, m.required).max(254, m.max(254)).email(m.email),
      password: z.string().refine(isStrongPassword, m.passwordWeak),
      confirm: z.string().min(1, m.required),
    })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: m.mismatch });

export const resetSchema = (m: AuthMessages) =>
  z
    .object({ password: z.string().refine(isStrongPassword, m.passwordWeak), confirm: z.string().min(1, m.required) })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: m.mismatch });
