import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { CONTACT_REVEAL_COPY } from "@/lib/contact-reveal/constants";
import { prepareContactReveal } from "@/lib/contact-reveal/service";
import { contactRevealPrepareSchema } from "@/lib/contact-reveal/validation";
import { NextResponse } from "next/server";

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

    const body = (await request.json()) as Record<string, unknown>;
    const parsed = contactRevealPrepareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: CONTACT_REVEAL_COPY.validationError },
        { status: 400 },
      );
    }

    const preview = await prepareContactReveal({
      userId: user.id,
      publicId: parsed.data.publicId,
      channel: parsed.data.channel,
      value: parsed.data.value,
    });

    return NextResponse.json({
      contactVersionId: preview.contactVersionId,
      channel: preview.channel,
      displayValue: preview.displayValue,
    });
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : CONTACT_REVEAL_COPY.genericError;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
