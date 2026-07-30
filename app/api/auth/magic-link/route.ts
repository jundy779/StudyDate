import { getSiteOrigin } from "@/lib/auth/site-url";
import { magicLinkRequestSchema } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

const MAX_REQUEST_BYTES = 2_048;
const GENERIC_ERROR =
  "Tautan masuk belum dapat dikirim. Coba lagi beberapa saat lagi.";

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 413 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
      return NextResponse.json({ message: GENERIC_ERROR }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { message: "Masukkan alamat email yang valid." },
      { status: 400 },
    );
  }

  const parsed = magicLinkRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Masukkan alamat email yang valid." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const callbackUrl = new URL("/auth/callback", getSiteOrigin(request));
    callbackUrl.searchParams.set("next", "/app");

    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: true,
      },
    });

    if (error) {
      return NextResponse.json({ message: GENERIC_ERROR }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 503 });
  }
}
