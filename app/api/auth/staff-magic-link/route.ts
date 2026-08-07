import { deliverStudyDateMagicLink } from "@/lib/auth/magic-link-delivery";
import { getSiteOrigin } from "@/lib/auth/site-url";
import { magicLinkRequestSchema } from "@/lib/auth/validation";
import { NextResponse, type NextRequest } from "next/server";

const MAX_REQUEST_BYTES = 2_048;
const GENERIC_RESPONSE = {
  ok: true,
  message: "Jika akun memenuhi syarat, tautan masuk akan dikirim.",
};

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { message: "Permintaan belum dapat diproses." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { message: "Permintaan belum dapat diproses." },
        { status: 413 },
      );
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
    await deliverStudyDateMagicLink({
      email: parsed.data.email,
      origin: getSiteOrigin(request),
      nextPath: "/staff",
      kind: "staff",
      allowCreateUser: false,
    });
  } catch {
    // Identical response prevents account enumeration.
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
