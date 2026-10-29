import { config } from "./config";

type Level = "error" | "warn" | "info" | "debug";
const ORDER: Record<Level | "silent", number> = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

const REDACT_PATTERN = /pass(word)?|secret|token|cookie|authorization|csrf|checksum|apikey|api_key|recovery/i;
const REDACT_EXACT = new Set(["otp", "sid", "totp", "mfacode"]);
const shouldRedact = (key: string) => REDACT_PATTERN.test(key) || REDACT_EXACT.has(key.toLowerCase());

/** Deep-copies `value`, replacing sensitive keys with "[redacted]". */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = shouldRedact(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

function enabled(level: Level): boolean {
  let configured: ReturnType<typeof config>["logLevel"] = "info";
  try {
    configured = config().logLevel;
  } catch {
    // config invalid → still log errors
  }
  return ORDER[level] <= ORDER[configured];
}

function write(level: Level, fields: Record<string, unknown> | undefined, msg: string): void {
  if (!enabled(level)) return;
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...(redact(fields ?? {}) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  error: (fields: Record<string, unknown> | undefined, msg: string) => write("error", fields, msg),
  warn: (fields: Record<string, unknown> | undefined, msg: string) => write("warn", fields, msg),
  info: (fields: Record<string, unknown> | undefined, msg: string) => write("info", fields, msg),
  debug: (fields: Record<string, unknown> | undefined, msg: string) => write("debug", fields, msg),
};
