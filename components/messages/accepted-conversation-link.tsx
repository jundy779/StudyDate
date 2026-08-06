import { getConversationPublicIdForIntroduction } from "@/lib/messages/service";
import Link from "next/link";

export async function AcceptedConversationLink({
  requestId,
}: {
  requestId: string;
}) {
  const publicId = await getConversationPublicIdForIntroduction(requestId);

  if (!publicId) {
    return (
      <Link
        href="/app/messages"
        className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white"
      >
        Buka Pesan
      </Link>
    );
  }

  return (
    <Link
      href={`/app/messages/${publicId}`}
      className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white"
    >
      Mulai percakapan
    </Link>
  );
}
