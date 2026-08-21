import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { IDENTITY_REVEAL_COPY } from "@/lib/identity-reveal/constants";
import { createIdentityRevealProfile } from "@/lib/identity-reveal/service";
import { identityRevealProfileSchema } from "@/lib/identity-reveal/validation";
import { consumeIdentityRevealPhotoAttempt } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";

const MAX_FORM_BYTES = 6 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const profile = await getPrivateProfile(user.id);
    if (!profile?.onboarding_completed_at) {
      return NextResponse.json({ error: "onboarding" }, { status: 403 });
    }

    if (!(await consumeIdentityRevealPhotoAttempt(user.id))) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan unggah. Coba lagi nanti." },
        { status: 429 },
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_FORM_BYTES) {
      return NextResponse.json(
        { error: IDENTITY_REVEAL_COPY.photoError },
        { status: 413 },
      );
    }

    const formData = await request.formData();
    const parsed = identityRevealProfileSchema.safeParse({
      publicId: formData.get("publicId"),
      firstName: formData.get("firstName"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: IDENTITY_REVEAL_COPY.photoError },
        { status: 400 },
      );
    }

    const photo = formData.get("photo");
    if (!(photo instanceof File) || photo.size <= 0) {
      return NextResponse.json(
        { error: IDENTITY_REVEAL_COPY.photoError },
        { status: 400 },
      );
    }

    if (photo.size > MAX_FORM_BYTES) {
      return NextResponse.json(
        { error: IDENTITY_REVEAL_COPY.photoError },
        { status: 413 },
      );
    }

    const bytes = Buffer.from(await photo.arrayBuffer());
    const preview = await createIdentityRevealProfile({
      userId: user.id,
      publicId: parsed.data.publicId,
      firstName: parsed.data.firstName,
      photoBytes: bytes,
    });

    return NextResponse.json({
      profileVersionId: preview.profileVersionId,
      firstName: preview.firstName,
      photoReady: preview.photoReady,
    });
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : IDENTITY_REVEAL_COPY.genericError;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
