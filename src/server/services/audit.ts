import type { ClientSession, Types } from "mongoose";
import { redact } from "../logger";
import { AuditLog } from "../models";

export interface AuditEntry {
  actorId?: Types.ObjectId | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  changes?: Record<string, unknown>;
  requestId?: string | null;
  ip?: string | null;
}

/** Appends an audit record. Sensitive keys are redacted before storage. */
export async function audit(entry: AuditEntry, session?: ClientSession): Promise<void> {
  const doc = {
    actorId: entry.actorId ?? null,
    actorEmail: entry.actorEmail ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    changes: (redact(entry.changes ?? {}) as Record<string, unknown>) ?? {},
    requestId: entry.requestId ?? null,
    ip: entry.ip ?? null,
  };
  await AuditLog.create([doc], session ? { session } : {});
}
