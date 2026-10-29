import { z } from "zod";

/** Accepts +374XXXXXXXX or 0XXXXXXXX (spaces, dashes and brackets ignored) and normalizes to +374XXXXXXXX. */
export function normalizeArmenianPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "");
  const match = /^(?:\+374|00374|374|0)(\d{8})$/.exec(digits);
  return match ? `+374${match[1]}` : null;
}

export type CheckoutMessages = {
  required: string;
  email: string;
  phone: string;
  max: (max: number) => string;
  region: string;
  ageRequired: string;
  termsRequired: string;
};

export function checkoutSchema(m: CheckoutMessages, regionCodes: string[]) {
  const text = (max: number) => z.string().trim().min(1, m.required).max(max, m.max(max));
  return z.object({
    firstName: text(60),
    lastName: text(60),
    email: z.string().trim().min(1, m.required).max(254, m.max(254)).email(m.email),
    phone: z
      .string()
      .trim()
      .min(1, m.required)
      .refine((v) => normalizeArmenianPhone(v) !== null, m.phone),
    region: z.string().refine((v) => regionCodes.includes(v), m.region),
    city: text(80),
    line1: text(160),
    line2: z.string().trim().max(160, m.max(160)),
    notes: z.string().trim().max(500, m.max(500)),
    paymentMethod: z.enum(["cod", "idram", "arca", "mock"]),
    ageConfirmed: z.boolean().refine((v) => v, m.ageRequired),
    termsAccepted: z.boolean().refine((v) => v, m.termsRequired),
    saveAddress: z.boolean(),
  });
}

export type CheckoutFormValues = z.infer<ReturnType<typeof checkoutSchema>>;

/** Maps an API validation path (e.g. "customer.email") to a form field name. */
export function fieldForApiPath(path: string | undefined): keyof CheckoutFormValues | null {
  if (!path) return null;
  const last = path.split(".").pop() ?? "";
  const known: (keyof CheckoutFormValues)[] = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "region",
    "city",
    "line1",
    "line2",
    "notes",
    "paymentMethod",
    "ageConfirmed",
    "termsAccepted",
  ];
  return (known as string[]).includes(last) ? (last as keyof CheckoutFormValues) : null;
}
