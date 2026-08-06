import "server-only";

import {
  IDENTITY_REVEAL_COPY,
  IDENTITY_REVEAL_PHOTO_BUCKET,
  type IdentityRevealCompleted,
  type IdentityRevealProfilePreview,
  type IdentityRevealState,
} from "@/lib/identity-reveal/constants";
import { processIdentityRevealPhoto } from "@/lib/identity-reveal/photo";
import { identityRevealProfileSchema } from "@/lib/identity-reveal/validation";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type StateRow = {
  eligible: boolean;
  has_profile: boolean;
  selected_by_me: boolean;
  completed: boolean;
  completed_at: string | null;
  can_withdraw: boolean;
};

type PreviewRow = {
  profile_version_id: string;
  first_name: string;
  photo_ready: boolean;
  created_at: string;
};

type CompletedRow = {
  completed: boolean;
  completed_at: string | null;
  mine_first_name: string | null;
  counterpart_first_name: string | null;
};

function mapState(row: StateRow | null | undefined): IdentityRevealState {
  if (!row) {
    return {
      eligible: false,
      hasProfile: false,
      selectedByMe: false,
      completed: false,
      completedAt: null,
      canWithdraw: false,
    };
  }

  return {
    eligible: Boolean(row.eligible),
    hasProfile: Boolean(row.has_profile),
    selectedByMe: Boolean(row.selected_by_me),
    completed: Boolean(row.completed),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    canWithdraw: Boolean(row.can_withdraw),
  };
}

function mapRevealError(message: string | undefined): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("conversation closed")) {
    return IDENTITY_REVEAL_COPY.closedNote;
  }
  if (
    text.includes("identity reveal unavailable") ||
    text.includes("mutual")
  ) {
    return IDENTITY_REVEAL_COPY.notReadyNote;
  }
  if (text.includes("invalid first name") || text.includes("photo")) {
    return IDENTITY_REVEAL_COPY.photoError;
  }
  return IDENTITY_REVEAL_COPY.genericError;
}

export async function getIdentityRevealState(
  publicId: string,
): Promise<IdentityRevealState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_identity_reveal_state", {
    p_public_id: publicId,
  });

  if (error) {
    return mapState(null);
  }

  return mapState((data ?? [])[0] as StateRow | undefined);
}

export async function getIdentityRevealProfilePreview(
  publicId: string,
): Promise<IdentityRevealProfilePreview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_identity_reveal_profile_preview",
    { p_public_id: publicId },
  );

  if (error) {
    return null;
  }

  const row = (data ?? [])[0] as PreviewRow | undefined;
  if (!row?.profile_version_id) {
    return null;
  }

  return {
    profileVersionId: String(row.profile_version_id),
    firstName: String(row.first_name),
    photoReady: Boolean(row.photo_ready),
    createdAt: String(row.created_at),
  };
}

export async function getCompletedIdentityReveal(
  publicId: string,
): Promise<IdentityRevealCompleted> {
  const empty: IdentityRevealCompleted = {
    completed: false,
    completedAt: null,
    mineFirstName: null,
    counterpartFirstName: null,
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_completed_identity_reveal", {
    p_public_id: publicId,
  });

  if (error) {
    return empty;
  }

  const row = (data ?? [])[0] as CompletedRow | undefined;
  if (!row?.completed) {
    return empty;
  }

  return {
    completed: true,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    mineFirstName: row.mine_first_name ? String(row.mine_first_name) : null,
    counterpartFirstName: row.counterpart_first_name
      ? String(row.counterpart_first_name)
      : null,
  };
}

export async function selectIdentityReveal(
  publicId: string,
  profileVersionId: string,
): Promise<IdentityRevealState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("select_identity_reveal", {
    p_public_id: publicId,
    p_profile_version_id: profileVersionId,
  });

  if (error) {
    throw new Error(mapRevealError(error.message));
  }

  return mapState((data ?? [])[0] as StateRow | undefined);
}

export async function withdrawIdentityReveal(
  publicId: string,
): Promise<IdentityRevealState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("withdraw_identity_reveal", {
    p_public_id: publicId,
  });

  if (error) {
    throw new Error(mapRevealError(error.message));
  }

  return mapState((data ?? [])[0] as StateRow | undefined);
}

export async function createIdentityRevealProfile(input: {
  userId: string;
  publicId: string;
  firstName: string;
  photoBytes: Buffer;
}): Promise<IdentityRevealProfilePreview> {
  const parsed = identityRevealProfileSchema.safeParse({
    publicId: input.publicId,
    firstName: input.firstName,
  });
  if (!parsed.success) {
    throw new Error(IDENTITY_REVEAL_COPY.photoError);
  }

  const admin = createServerAdminClient();
  if (!admin) {
    throw new Error(IDENTITY_REVEAL_COPY.genericError);
  }

  const processed = await processIdentityRevealPhoto(input.photoBytes);

  const { error: uploadError } = await admin.storage
    .from(IDENTITY_REVEAL_PHOTO_BUCKET)
    .upload(processed.objectKey, processed.buffer, {
      contentType: processed.contentType,
      upsert: false,
      cacheControl: "private, max-age=0",
    });

  if (uploadError) {
    throw new Error(IDENTITY_REVEAL_COPY.photoError);
  }

  const { data: versionId, error: registerError } = await admin.rpc(
    "register_identity_reveal_profile_version",
    {
      p_public_id: input.publicId,
      p_owner_user_id: input.userId,
      p_first_name: parsed.data.firstName,
      p_photo_object_key: processed.objectKey,
      p_photo_content_type: processed.contentType,
      p_photo_byte_size: processed.byteSize,
      p_photo_width: processed.width,
      p_photo_height: processed.height,
    },
  );

  if (registerError || !versionId) {
    await admin.storage
      .from(IDENTITY_REVEAL_PHOTO_BUCKET)
      .remove([processed.objectKey])
      .catch(() => undefined);
    throw new Error(mapRevealError(registerError?.message));
  }

  return {
    profileVersionId: String(versionId),
    firstName: parsed.data.firstName,
    photoReady: true,
    createdAt: new Date().toISOString(),
  };
}
