import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/server/config";
import { safeEqual } from "@/server/crypto";
import { runJobsOnce } from "@/server/jobs";
import { errorResponse } from "@/server/http/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Scheduler entry point for serverless hosting (e.g. a platform cron). Bearer CRON_SECRET. */
export async function POST(req: NextRequest) {
  const secret = config().cronSecret;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const result = await runJobsOnce();
    return NextResponse.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err, "cron");
  }
}
