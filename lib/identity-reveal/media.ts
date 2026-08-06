import "server-only";

import {
  IDENTITY_REVEAL_COPY,
  IDENTITY_REVEAL_PHOTO_BUCKET,
} from "@/lib/identity-reveal/constants";
import { createServerAdminClient } from "@/lib/supabase/admin";

export async function loadIdentityRevealPhotoBytes(input: {
  publicId: string;
  viewerUserId: string;
  which: "mine" | "counterpart";
}): Promise<{ buffer: Buffer; contentType: string } | null> {
  const admin = createServerAdminClient();
  if (!admin) {
    return null;
  }

  const { data, error } = await admin.rpc("resolve_identity_reveal_photo_key", {
    p_public_id: input.publicId,
    p_viewer_user_id: input.viewerUserId,
    p_which: input.which,
  });

  if (error) {
    return null;
  }

  const row = (data ?? [])[0] as
    | { photo_object_key?: string; photo_content_type?: string }
    | undefined;

  if (!row?.photo_object_key || !row.photo_content_type) {
    return null;
  }

  const downloaded = await admin.storage
    .from(IDENTITY_REVEAL_PHOTO_BUCKET)
    .download(row.photo_object_key);

  if (downloaded.error || !downloaded.data) {
    return null;
  }

  const buffer = Buffer.from(await downloaded.data.arrayBuffer());
  return { buffer, contentType: row.photo_content_type };
}

export async function loadMyIdentityRevealPreviewPhotoBytes(
  ownerUserId: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const admin = createServerAdminClient();
  if (!admin) {
    return null;
  }

  const { data, error } = await admin.rpc(
    "resolve_my_identity_reveal_preview_photo_key",
    { p_owner_user_id: ownerUserId },
  );

  if (error) {
    return null;
  }

  const row = (data ?? [])[0] as
    | { photo_object_key?: string; photo_content_type?: string }
    | undefined;

  if (!row?.photo_object_key || !row.photo_content_type) {
    return null;
  }

  const downloaded = await admin.storage
    .from(IDENTITY_REVEAL_PHOTO_BUCKET)
    .download(row.photo_object_key);

  if (downloaded.error || !downloaded.data) {
    return null;
  }

  const buffer = Buffer.from(await downloaded.data.arrayBuffer());
  return { buffer, contentType: row.photo_content_type };
}

export function identityRevealMediaUnavailable() {
  return new Response(IDENTITY_REVEAL_COPY.genericError, { status: 404 });
}
