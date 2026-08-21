import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { deleteQueuedIdentityRevealPhotos } from "@/lib/identity-reveal/cleanup";
import {
  deleteExpiredVerificationEvidence,
  recordVerificationCleanupHealth,
} from "@/lib/verification/review";

const ERROR = "Cleanup verifikasi belum dapat dijalankan.";

function isAuthorized(request: NextRequest) {
  const bearer = request.headers.get("authorization");
  const expected =
    request.method === "GET"
      ? process.env.CRON_SECRET
      : process.env.STUDENT_VERIFICATION_CLEANUP_SECRET;
  const provided =
    request.method === "GET"
      ? bearer?.startsWith("Bearer ")
        ? bearer.slice(7)
        : null
      : request.headers.get("x-studydate-cleanup-secret");
  if (!expected || expected.length < 32 || !provided) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

async function cleanup(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: ERROR },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await recordVerificationCleanupHealth("running", {
      processedCount: 0,
      failedCount: 0,
      remainingCount: 0,
    });
    const result = await deleteExpiredVerificationEvidence(
      new Date().toISOString(),
    );
    const revealPhotos = await deleteQueuedIdentityRevealPhotos();
    await recordVerificationCleanupHealth("succeeded", {
      ...result,
    });
    return NextResponse.json(
      { ok: true, ...result, revealPhotos },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    await recordVerificationCleanupHealth("failed", {
      processedCount: 0,
      failedCount: 1,
      remainingCount: 1,
    }).catch(() => undefined);
    return NextResponse.json(
      { message: ERROR },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = cleanup;
export const POST = cleanup;
