import "server-only";

import { IDENTITY_REVEAL_PHOTO_BUCKET } from "@/lib/identity-reveal/constants";
import { createServerAdminClient } from "@/lib/supabase/admin";

type CleanupCandidate = {
  object_key: string;
  profile_version_id: string | null;
};

export async function deleteQueuedIdentityRevealPhotos() {
  const admin = createServerAdminClient();
  if (!admin) throw new Error("Pembersihan foto belum dapat dijalankan.");

  const { data, error } = await admin.rpc(
    "list_identity_reveal_photo_cleanup_candidates",
    { p_limit: 50 },
  );
  if (error) throw new Error("Pembersihan foto belum dapat dijalankan.");

  let processedCount = 0;
  let failedCount = 0;
  for (const candidate of (data ?? []) as CleanupCandidate[]) {
    const { error: removalError } = await admin.storage
      .from(IDENTITY_REVEAL_PHOTO_BUCKET)
      .remove([candidate.object_key]);
    if (removalError) {
      failedCount += 1;
      continue;
    }

    const { error: finalizeError } = await admin.rpc(
      "finalize_identity_reveal_photo_cleanup",
      {
        p_object_key: candidate.object_key,
        p_profile_version_id: candidate.profile_version_id,
      },
    );
    if (finalizeError) {
      failedCount += 1;
      continue;
    }
    processedCount += 1;
  }

  return { processedCount, failedCount };
}
