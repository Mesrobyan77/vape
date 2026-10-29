import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness only — never touches dependencies or discloses configuration. */
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
