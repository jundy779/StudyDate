import { createClient } from "@/lib/supabase/server";
import { takeVerificationRateLimit } from "@/lib/verification/rate-limit";
import { confirmCampusEmailCode } from "@/lib/verification/service";
import { campusEmailCodeSchema } from "@/lib/verification/validation";
import { NextResponse, type NextRequest } from "next/server";
import { isVerificationRequestAllowed } from "@/lib/verification/readiness";

const ERROR = "Kode tidak dapat dikonfirmasi. Periksa kembali atau minta kode baru.";

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? "0") > 1024) {
    return NextResponse.json({ message: ERROR }, { status: 413 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sesi telah berakhir." }, { status: 401 });
  if (!(await isVerificationRequestAllowed(user.id))) {
    return NextResponse.json({ message: ERROR }, { status: 503 });
  }
  if (!takeVerificationRateLimit(`email-confirm:${user.id}`, 10, 15 * 60_000)) {
    return NextResponse.json({ message: ERROR }, { status: 429 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: ERROR }, { status: 400 });
  }
  const parsed = campusEmailCodeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: ERROR }, { status: 400 });
  try {
    await confirmCampusEmailCode(user.id, parsed.data.requestId, parsed.data.code);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: ERROR }, { status: 400 });
  }
}
