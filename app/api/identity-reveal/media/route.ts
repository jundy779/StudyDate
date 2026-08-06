import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  identityRevealMediaUnavailable,
  loadIdentityRevealPhotoBytes,
  loadIdentityRevealPreviewPhotoBytes,
} from "@/lib/identity-reveal/media";
import { conversationPublicIdSchema } from "@/lib/messages/validation";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const querySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("preview"),
    publicId: conversationPublicIdSchema,
  }),
  z.object({
    mode: z.literal("completed"),
    publicId: conversationPublicIdSchema,
    which: z.enum(["mine", "counterpart"]),
  }),
]);

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) {
    return NextResponse.json({ error: "onboarding" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    mode: params.get("mode"),
    publicId: params.get("publicId"),
    which: params.get("which") ?? undefined,
  });

  if (!parsed.success) {
    return identityRevealMediaUnavailable();
  }

  const loaded =
    parsed.data.mode === "preview"
      ? await loadIdentityRevealPreviewPhotoBytes({
          publicId: parsed.data.publicId,
          ownerUserId: user.id,
        })
      : await loadIdentityRevealPhotoBytes({
          publicId: parsed.data.publicId,
          viewerUserId: user.id,
          which: parsed.data.which,
        });

  if (!loaded) {
    return identityRevealMediaUnavailable();
  }

  return new NextResponse(new Uint8Array(loaded.buffer), {
    status: 200,
    headers: {
      "Content-Type": loaded.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
