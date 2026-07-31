import { createClient } from "@/lib/supabase/server";
import { takeVerificationRateLimit } from "@/lib/verification/rate-limit";
import { sendCampusEmailCode } from "@/lib/verification/service";
import { campusEmailSchema } from "@/lib/verification/validation";
import { NextResponse, type NextRequest } from "next/server";

const ERROR = "Kode belum dapat dikirim. Periksa data dan coba lagi.";

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? "0") > 2048) {
    return NextResponse.json({ message: ERROR }, { status: 413 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sesi telah berakhir." }, { status: 401 });
  if (!takeVerificationRateLimit(`email-send:${user.id}`, 5, 15 * 60_000)) {
    return NextResponse.json({ message: ERROR }, { status: 429 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: ERROR }, { status: 400 });
  }
  const parsed = campusEmailSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: ERROR }, { status: 400 });
  try {
    await sendCampusEmailCode(user.id, parsed.data.requestId, parsed.data.email);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: ERROR }, { status: 400 });
  }
}
