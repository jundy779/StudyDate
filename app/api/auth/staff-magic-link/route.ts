import { getSiteOrigin } from "@/lib/auth/site-url";
import { magicLinkRequestSchema } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

const MAX_REQUEST_BYTES = 2_048;
const GENERIC_RESPONSE = {
  ok: true,
  message: "Jika akun memenuhi syarat, tautan masuk akan dikirim.",
};

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ message: "Permintaan belum dapat diproses." }, { status: 413 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
      return NextResponse.json({ message: "Permintaan belum dapat diproses." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Masukkan alamat email yang valid." }, { status: 400 });
  }

  const parsed = magicLinkRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Masukkan alamat email yang valid." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const callbackUrl = new URL("/auth/callback", getSiteOrigin(request));
    callbackUrl.searchParams.set("next", "/staff");
    await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: callbackUrl.toString(), shouldCreateUser: false },
    });
  } catch {
    // The response intentionally remains identical to prevent account enumeration.
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
