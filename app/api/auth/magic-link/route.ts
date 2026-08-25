import { deliverStudyDateMagicLink } from "@/lib/auth/magic-link-delivery";
import { getSiteOrigin } from "@/lib/auth/site-url";
import { canReceiveStudentMagicLink } from "@/lib/early-access/access";
import { magicLinkRequestSchema } from "@/lib/auth/validation";
import { consumeMagicLinkAttempts } from "@/lib/security/rate-limit";
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
    const message =
      parsed.error.issues[0]?.message ?? "Masukkan alamat email yang valid.";
    return NextResponse.json({ message }, { status: 400 });
  }

  if (!(await consumeMagicLinkAttempts(request, parsed.data.email))) {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 429 });
  }

  try {
    // Keep the public response enumeration-safe. Existing accounts can log in;
    // new/pre-onboarding accounts need an approved Early Access row first.
    if (!(await canReceiveStudentMagicLink(parsed.data.email))) {
      return NextResponse.json({ ok: true });
    }

    await deliverStudyDateMagicLink({
      email: parsed.data.email,
      origin: getSiteOrigin(request),
      nextPath: "/app",
      kind: "student",
      allowCreateUser: true,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 503 });
  }
}
