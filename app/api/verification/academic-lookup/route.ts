import { createHash } from "node:crypto";
import { lookupAcademicIdentity } from "@/lib/verification/lookup-service";
import { consumeApiRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { academicLookupSchema } from "@/lib/verification/validation";
import { isVerificationRequestAllowed } from "@/lib/verification/readiness";
import { NextResponse, type NextRequest } from "next/server";

const MAX_BYTES = 2_048;
const GENERIC_ERROR = "Data akademik belum dapat diperiksa. Coba lagi.";

export const maxDuration = 40;

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    contentLength < 1 ||
    contentLength > MAX_BYTES ||
    !request.headers.get("content-type")?.includes("application/json")
  ) {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Sesi telah berakhir." }, { status: 401 });
  }
  if (!(await isVerificationRequestAllowed(user.id))) {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 503 });
  }

  const subjectHash = createHash("sha256")
    .update(`verification:${user.id}`)
    .digest("hex");
  const [hourAllowed, dayAllowed] = await Promise.all([
    consumeApiRateLimit({
      bucket: "verification_lookup_hour",
      subjectHash,
      limit: 3,
      windowSeconds: 60 * 60,
    }),
    consumeApiRateLimit({
      bucket: "verification_lookup_day",
      subjectHash,
      limit: 6,
      windowSeconds: 24 * 60 * 60,
    }),
  ]);
  if (!hourAllowed || !dayAllowed) {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 400 });
  }
  const parsed = academicLookupSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 400 });
  }

  try {
    const result = await lookupAcademicIdentity(
      user.id,
      parsed.data,
      undefined,
      request.signal,
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 503 });
  }
}
