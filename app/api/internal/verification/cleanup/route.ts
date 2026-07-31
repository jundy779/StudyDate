import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { deleteExpiredVerificationEvidence } from "@/lib/verification/review";

const ERROR = "Cleanup verifikasi belum dapat dijalankan.";

function isAuthorized(request: NextRequest) {
  const expected = process.env.STUDENT_VERIFICATION_CLEANUP_SECRET;
  const provided = request.headers.get("x-studydate-cleanup-secret");
  if (!expected || expected.length < 32 || !provided) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: ERROR }, { status: 404 });
  }

  try {
    await deleteExpiredVerificationEvidence(new Date().toISOString());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: ERROR }, { status: 503 });
  }
}
