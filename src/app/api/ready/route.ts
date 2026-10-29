import { NextResponse } from "next/server";
import { pingDb } from "@/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Readiness: verifies the database is reachable. Returns only safe operational information. */
export async function GET() {
  const database = (await pingDb()) ? "ok" : "fail";
  const ready = database === "ok";
  return NextResponse.json(
    { status: ready ? "ready" : "not_ready", checks: { database } },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
