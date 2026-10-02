import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  listConversationMessages,
  toggleAnonymousMessageReaction,
} from "@/lib/messages/service";
import {
  conversationPublicIdSchema,
  messageReactionSchema,
} from "@/lib/messages/validation";
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{ publicId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  }

  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) {
    return NextResponse.json(
      { error: "Selesaikan pengaturan awal akunmu terlebih dahulu." },
      { status: 403 },
    );
  }

  const { publicId: rawPublicId } = await context.params;
  const publicId = conversationPublicIdSchema.safeParse(rawPublicId);
  if (!publicId.success) {
    return NextResponse.json(
      { error: "Percakapan tidak ditemukan." },
      { status: 404 },
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const parsed = messageReactionSchema.safeParse({
    publicId: publicId.data,
    messageId: payload?.messageId,
    reaction: payload?.reaction ?? null,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Reaksi tidak dikenali." },
      { status: 400 },
    );
  }

  try {
    await toggleAnonymousMessageReaction(parsed.data);
    const messages = await listConversationMessages(parsed.data.publicId, {
      limit: 50,
    });
    const message = messages.find(
      (item) => item.message_id === parsed.data.messageId,
    );
    if (!message) {
      return NextResponse.json(
        { error: "Pesan tidak ditemukan." },
        { status: 404 },
      );
    }
    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Reaksi belum dapat disimpan. Coba lagi.",
      },
      { status: 400 },
    );
  }
}
