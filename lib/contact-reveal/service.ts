import "server-only";

import {
  CONTACT_REVEAL_CHANNELS,
  CONTACT_REVEAL_COPY,
  emptyContactRevealState,
  type ContactRevealChannel,
  type ContactRevealChannelState,
  type ContactRevealCompletedChannel,
  type ContactRevealPreview,
  type ContactRevealState,
} from "@/lib/contact-reveal/constants";
import {
  decryptContactValue,
  encryptContactValue,
  isContactRevealKeyConfigured,
  normalizeByteaInput,
} from "@/lib/contact-reveal/crypto";
import {
  contactRevealPrepareSchema,
  formatContactDisplay,
  formatContactHref,
  normalizeContactValue,
} from "@/lib/contact-reveal/validation";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ChannelRow = {
  channel: string;
  eligible: boolean;
  has_contact: boolean;
  selected_by_me: boolean;
  completed: boolean;
  completed_at: string | null;
  can_withdraw: boolean;
};

type PreviewRow = {
  contact_version_id: string;
  channel: string;
  created_at: string;
};

type CipherRow = {
  completed: boolean;
  completed_at: string | null;
  mine_ciphertext: unknown;
  mine_iv: unknown;
  mine_auth_tag: unknown;
  counterpart_ciphertext: unknown;
  counterpart_iv: unknown;
  counterpart_auth_tag: unknown;
};

function mapChannel(row: ChannelRow | undefined): ContactRevealChannelState | null {
  if (!row) return null;
  if (!CONTACT_REVEAL_CHANNELS.includes(row.channel as ContactRevealChannel)) {
    return null;
  }
  return {
    channel: row.channel as ContactRevealChannel,
    eligible: Boolean(row.eligible),
    hasContact: Boolean(row.has_contact),
    selectedByMe: Boolean(row.selected_by_me),
    completed: Boolean(row.completed),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    canWithdraw: Boolean(row.can_withdraw),
  };
}

function mapState(rows: ChannelRow[] | null | undefined): ContactRevealState {
  const byChannel = new Map<string, ContactRevealChannelState>();
  for (const row of rows ?? []) {
    const mapped = mapChannel(row);
    if (mapped) byChannel.set(mapped.channel, mapped);
  }
  return {
    channels: CONTACT_REVEAL_CHANNELS.map(
      (channel) =>
        byChannel.get(channel) ?? {
          channel,
          eligible: false,
          hasContact: false,
          selectedByMe: false,
          completed: false,
          completedAt: null,
          canWithdraw: false,
        },
    ),
  };
}

function mapRevealError(message: string | undefined): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("conversation closed")) {
    return CONTACT_REVEAL_COPY.closedNote;
  }
  if (
    text.includes("contact reveal unavailable") ||
    text.includes("identity reveal")
  ) {
    return CONTACT_REVEAL_COPY.notReadyNote;
  }
  if (text.includes("invalid")) {
    return CONTACT_REVEAL_COPY.validationError;
  }
  return CONTACT_REVEAL_COPY.genericError;
}

function decryptSide(
  ciphertext: unknown,
  iv: unknown,
  authTag: unknown,
): string | null {
  if (!ciphertext || !iv || !authTag) return null;
  try {
    return decryptContactValue({
      ciphertext: normalizeByteaInput(ciphertext),
      iv: normalizeByteaInput(iv),
      authTag: normalizeByteaInput(authTag),
    });
  } catch {
    return null;
  }
}

export async function getContactRevealState(
  publicId: string,
): Promise<ContactRevealState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_contact_reveal_state", {
    p_public_id: publicId,
  });
  if (error) {
    return emptyContactRevealState();
  }
  return mapState((data ?? []) as ChannelRow[]);
}

export async function getContactRevealPreview(
  publicId: string,
  channel: ContactRevealChannel,
): Promise<ContactRevealPreview | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("get_contact_reveal_preview", {
    p_public_id: publicId,
    p_channel: channel,
  });
  if (error) return null;
  const row = (data ?? [])[0] as PreviewRow | undefined;
  if (!row?.contact_version_id) return null;

  const admin = createServerAdminClient();
  if (!admin || !isContactRevealKeyConfigured()) {
    return {
      contactVersionId: String(row.contact_version_id),
      channel,
      displayValue: "••••",
      createdAt: String(row.created_at),
    };
  }

  const { data: cipherData, error: cipherError } = await admin.rpc(
    "resolve_contact_reveal_preview_cipher",
    {
      p_public_id: publicId,
      p_owner_user_id: user.id,
      p_channel: channel,
    },
  );

  const cipher = (cipherData ?? [])[0] as
    | {
        contact_ciphertext?: unknown;
        contact_iv?: unknown;
        contact_auth_tag?: unknown;
      }
    | undefined;

  const plaintext =
    !cipherError && cipher
      ? decryptSide(
          cipher.contact_ciphertext,
          cipher.contact_iv,
          cipher.contact_auth_tag,
        )
      : null;

  return {
    contactVersionId: String(row.contact_version_id),
    channel,
    displayValue: plaintext
      ? formatContactDisplay(channel, plaintext)
      : "••••",
    createdAt: String(row.created_at),
  };
}

export async function getCompletedContactReveal(
  publicId: string,
  channel: ContactRevealChannel,
): Promise<ContactRevealCompletedChannel> {
  const empty: ContactRevealCompletedChannel = {
    channel,
    completed: false,
    completedAt: null,
    mineDisplay: null,
    counterpartDisplay: null,
    mineHref: null,
    counterpartHref: null,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const admin = createServerAdminClient();
  if (!admin || !isContactRevealKeyConfigured()) return empty;

  const { data, error } = await admin.rpc("get_completed_contact_reveal_cipher", {
    p_public_id: publicId,
    p_viewer_user_id: user.id,
    p_channel: channel,
  });
  if (error) return empty;

  const row = (data ?? [])[0] as CipherRow | undefined;
  if (!row?.completed) return empty;

  const mine = decryptSide(
    row.mine_ciphertext,
    row.mine_iv,
    row.mine_auth_tag,
  );
  const counterpart = decryptSide(
    row.counterpart_ciphertext,
    row.counterpart_iv,
    row.counterpart_auth_tag,
  );

  return {
    channel,
    completed: true,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    mineDisplay: mine ? formatContactDisplay(channel, mine) : null,
    counterpartDisplay: counterpart
      ? formatContactDisplay(channel, counterpart)
      : null,
    mineHref: mine ? formatContactHref(channel, mine) : null,
    counterpartHref: counterpart
      ? formatContactHref(channel, counterpart)
      : null,
  };
}

export async function getAllCompletedContactReveals(
  publicId: string,
  state: ContactRevealState,
): Promise<ContactRevealCompletedChannel[]> {
  const completedChannels = state.channels.filter((item) => item.completed);
  if (!completedChannels.length) return [];
  return Promise.all(
    completedChannels.map((item) =>
      getCompletedContactReveal(publicId, item.channel),
    ),
  );
}

export async function selectContactReveal(
  publicId: string,
  channel: ContactRevealChannel,
  contactVersionId: string,
): Promise<ContactRevealState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("select_contact_reveal", {
    p_public_id: publicId,
    p_channel: channel,
    p_contact_version_id: contactVersionId,
  });
  if (error) {
    throw new Error(mapRevealError(error.message));
  }
  return mapState((data ?? []) as ChannelRow[]);
}

export async function withdrawContactReveal(
  publicId: string,
  channel: ContactRevealChannel,
): Promise<ContactRevealState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("withdraw_contact_reveal", {
    p_public_id: publicId,
    p_channel: channel,
  });
  if (error) {
    throw new Error(mapRevealError(error.message));
  }
  return mapState((data ?? []) as ChannelRow[]);
}

export async function prepareContactReveal(input: {
  userId: string;
  publicId: string;
  channel: ContactRevealChannel;
  value: string;
}): Promise<ContactRevealPreview> {
  if (!isContactRevealKeyConfigured()) {
    throw new Error(CONTACT_REVEAL_COPY.genericError);
  }

  const parsed = contactRevealPrepareSchema.safeParse({
    publicId: input.publicId,
    channel: input.channel,
    value: input.value,
  });
  if (!parsed.success) {
    throw new Error(CONTACT_REVEAL_COPY.validationError);
  }

  let normalized: string;
  try {
    normalized = normalizeContactValue(parsed.data.channel, parsed.data.value);
  } catch {
    throw new Error(CONTACT_REVEAL_COPY.validationError);
  }

  const encrypted = encryptContactValue(normalized);
  const admin = createServerAdminClient();
  if (!admin) {
    throw new Error(CONTACT_REVEAL_COPY.genericError);
  }

  const { data: versionId, error } = await admin.rpc(
    "register_contact_reveal_version",
    {
      p_public_id: parsed.data.publicId,
      p_owner_user_id: input.userId,
      p_channel: parsed.data.channel,
      p_contact_ciphertext: encrypted.ciphertext,
      p_contact_iv: encrypted.iv,
      p_contact_auth_tag: encrypted.authTag,
      p_encryption_key_version: encrypted.keyVersion,
    },
  );

  if (error || !versionId) {
    throw new Error(mapRevealError(error?.message));
  }

  return {
    contactVersionId: String(versionId),
    channel: parsed.data.channel,
    displayValue: formatContactDisplay(parsed.data.channel, normalized),
    createdAt: new Date().toISOString(),
  };
}
