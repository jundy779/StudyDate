import {
  MAX_VERIFICATION_REQUEST_BYTES,
} from "@/lib/verification/constants";
import {
  submitVerificationRequest,
  VerificationServiceError,
} from "@/lib/verification/service";
import { takeVerificationRateLimit } from "@/lib/verification/rate-limit";
import { verificationSubmissionSchema } from "@/lib/verification/validation";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

const GENERIC_ERROR =
  "Permintaan verifikasi belum dapat dikirim. Periksa data dan coba lagi.";

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_VERIFICATION_REQUEST_BYTES) {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 413 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Sesi telah berakhir." }, { status: 401 });
  }
  if (!takeVerificationRateLimit(`submit:${user.id}`, 3, 24 * 60 * 60_000)) {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 400 });
  }
  const raw = Object.fromEntries(
    ["nim", "legalName", "campus", "studyProgram", "degreeLevel", "method", "consent"]
      .map((key) => [key, formData.get(key)]),
  );
  const parsed = verificationSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 400 });
  }
  const evidenceValue = formData.get("evidence");
  const evidence = evidenceValue instanceof File ? evidenceValue : null;

  try {
    const result = await submitVerificationRequest(user.id, parsed.data, evidence);
    return NextResponse.json({ ok: true, requestId: result.requestId });
  } catch (error) {
    const status =
      error instanceof VerificationServiceError && error.category === "duplicate"
        ? 409
        : 500;
    return NextResponse.json({ message: GENERIC_ERROR }, { status });
  }
}
