import { z } from "zod";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalBool = z.preprocess(emptyToUndefined, z.enum(["true", "false"]).optional());

const base64Key32 = z.string().refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 bytes encoded as base64");

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_SITE_URL: z.preprocess(emptyToUndefined, z.string().url().default("http://localhost:3000")),
    ALLOWED_ORIGINS: optionalString,
    MONGODB_URI: optionalString,
    MONGODB_DB_NAME: z.preprocess(emptyToUndefined, z.string().default("vapehub")),
    SESSION_SECRET: optionalString,
    COOKIE_DOMAIN: optionalString,
    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
    SMTP_HOST: optionalString,
    SMTP_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    SMTP_FROM: z.preprocess(emptyToUndefined, z.string().default("Vape Hub <no-reply@vapehub.local>")),
    ADMIN_NOTIFY_EMAIL: optionalString,
    PEXELS_API_KEY: optionalString,
    IDRAM_REC_ACCOUNT: optionalString,
    IDRAM_SECRET_KEY: optionalString,
    ARCA_API_URL: optionalString,
    ARCA_USERNAME: optionalString,
    ARCA_PASSWORD: optionalString,
    PAYMENT_MODE: z.preprocess(emptyToUndefined, z.enum(["live", "mock", "disabled"]).default("disabled")),
    MOCK_PAYMENT_SECRET: optionalString,
    MFA_ENCRYPTION_KEY: z.preprocess(emptyToUndefined, base64Key32.optional()),
    LOG_LEVEL: z.preprocess(emptyToUndefined, z.enum(["error", "warn", "info", "debug", "silent"]).default("info")),
    E2E_TEST_API_TOKEN: optionalString,
    CRON_SECRET: optionalString,
    JOBS_IN_PROCESS: optionalBool,
    RATE_LIMIT_STORE: z.preprocess(emptyToUndefined, z.enum(["memory", "mongo"]).optional()),
    RATE_LIMIT_DISABLED: optionalBool,
    TRUST_PROXY_HEADERS: optionalBool,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    for (const key of ["MONGODB_URI", "SESSION_SECRET", "MFA_ENCRYPTION_KEY"] as const) {
      if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "required in production" });
    }
    if (env.SESSION_SECRET && env.SESSION_SECRET.length < 32) {
      ctx.addIssue({ code: "custom", path: ["SESSION_SECRET"], message: "must be at least 32 characters" });
    }
    if (env.PAYMENT_MODE === "mock") {
      ctx.addIssue({ code: "custom", path: ["PAYMENT_MODE"], message: "mock payments are forbidden in production" });
    }
    if (env.E2E_TEST_API_TOKEN) {
      ctx.addIssue({ code: "custom", path: ["E2E_TEST_API_TOKEN"], message: "test endpoints are forbidden in production" });
    }
    if (env.RATE_LIMIT_DISABLED === "true") {
      ctx.addIssue({ code: "custom", path: ["RATE_LIMIT_DISABLED"], message: "rate limits cannot be disabled in production" });
    }
    if (!env.NEXT_PUBLIC_SITE_URL.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SITE_URL"], message: "production origin must use https" });
    }
  });

export type RawEnv = z.infer<typeof envSchema>;

// Development-only fallbacks. Never used when NODE_ENV=production (validated above).
const DEV_SESSION_SECRET = "dev-only-session-secret-not-for-production-use-000";
const DEV_MFA_KEY = Buffer.alloc(32, 7).toString("base64");
const DEV_MOCK_SECRET = "dev-only-mock-payment-secret";

export interface AppConfig {
  nodeEnv: RawEnv["NODE_ENV"];
  isProduction: boolean;
  isTest: boolean;
  siteUrl: string;
  allowedOrigins: string[];
  mongoUri: string | undefined;
  mongoDbName: string;
  sessionSecret: string;
  cookieDomain: string | undefined;
  cloudinary: { cloudName: string; apiKey: string; apiSecret: string } | null;
  smtp: { host: string; port: number; user?: string; pass?: string } | null;
  mailFrom: string;
  adminNotifyEmail: string | undefined;
  pexelsApiKey: string | undefined;
  idram: { recAccount: string; secretKey: string } | null;
  arca: { apiUrl: string; username: string; password: string } | null;
  paymentMode: RawEnv["PAYMENT_MODE"];
  mockPaymentSecret: string;
  mfaEncryptionKey: Buffer;
  logLevel: RawEnv["LOG_LEVEL"];
  e2eTestToken: string | undefined;
  cronSecret: string | undefined;
  jobsInProcess: boolean;
  rateLimitStore: "memory" | "mongo";
  rateLimitDisabled: boolean;
  trustProxyHeaders: boolean;
}

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    // Only variable names and messages are reported — never values.
    super(`Invalid configuration: ${issues.join("; ")}`);
  }
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const extra = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return {
    nodeEnv: env.NODE_ENV,
    isProduction,
    isTest: env.NODE_ENV === "test",
    siteUrl,
    allowedOrigins: [...new Set([siteUrl, ...extra])],
    mongoUri: env.MONGODB_URI,
    mongoDbName: env.MONGODB_DB_NAME,
    sessionSecret: env.SESSION_SECRET ?? DEV_SESSION_SECRET,
    cookieDomain: env.COOKIE_DOMAIN,
    cloudinary:
      env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
        ? { cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, apiSecret: env.CLOUDINARY_API_SECRET }
        : null,
    smtp: env.SMTP_HOST ? { host: env.SMTP_HOST, port: env.SMTP_PORT ?? 587, user: env.SMTP_USER, pass: env.SMTP_PASS } : null,
    mailFrom: env.SMTP_FROM,
    adminNotifyEmail: env.ADMIN_NOTIFY_EMAIL,
    pexelsApiKey: env.PEXELS_API_KEY,
    idram: env.IDRAM_REC_ACCOUNT && env.IDRAM_SECRET_KEY ? { recAccount: env.IDRAM_REC_ACCOUNT, secretKey: env.IDRAM_SECRET_KEY } : null,
    arca:
      env.ARCA_API_URL && env.ARCA_USERNAME && env.ARCA_PASSWORD
        ? { apiUrl: env.ARCA_API_URL.replace(/\/$/, ""), username: env.ARCA_USERNAME, password: env.ARCA_PASSWORD }
        : null,
    paymentMode: env.PAYMENT_MODE,
    mockPaymentSecret: env.MOCK_PAYMENT_SECRET ?? DEV_MOCK_SECRET,
    mfaEncryptionKey: Buffer.from(env.MFA_ENCRYPTION_KEY ?? DEV_MFA_KEY, "base64"),
    logLevel: env.LOG_LEVEL,
    e2eTestToken: isProduction ? undefined : env.E2E_TEST_API_TOKEN,
    cronSecret: env.CRON_SECRET,
    jobsInProcess: env.JOBS_IN_PROCESS ? env.JOBS_IN_PROCESS === "true" : env.NODE_ENV !== "test",
    rateLimitStore: env.RATE_LIMIT_STORE ?? (isProduction ? "mongo" : "memory"),
    rateLimitDisabled: !isProduction && env.RATE_LIMIT_DISABLED === "true",
    trustProxyHeaders: env.TRUST_PROXY_HEADERS ? env.TRUST_PROXY_HEADERS === "true" : true,
  };
}

let current: AppConfig | null = null;

export function config(): AppConfig {
  if (!current) current = loadConfig();
  return current;
}

/** Test hook: replace (or reset with null) the active configuration. */
export function setConfig(next: AppConfig | null): void {
  current = next;
}
