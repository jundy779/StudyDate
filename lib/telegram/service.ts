import "server-only";

import {
  TELEGRAM_BOT_USERNAME,
  TELEGRAM_LINK_TTL_SECONDS,
  TELEGRAM_MESSAGE,
  type TelegramSafeState,
} from "@/lib/telegram/constants";
import {
  createTelegramLinkToken,
  hashTelegramLinkToken,
  isTelegramCompanionCryptoConfigured,
} from "@/lib/telegram/crypto";
import { isTelegramCompanionEnabled } from "@/lib/telegram/bot-api";
import { createClient } from "@/lib/supabase/server";

type StateRow = {
  state: string;
  link_session_public_id: string | null;
  expires_at: string | null;
  connected: boolean;
  active_on_this_conversation: boolean;
  active_on_another_conversation: boolean;
};

function unavailableState(): TelegramSafeState {
  return {
    state: "unavailable",
    linkSessionPublicId: null,
    expiresAt: null,
    connected: false,
    activeOnThisConversation: false,
    activeOnAnotherConversation: false,
  };
}

function mapState(row: StateRow | undefined): TelegramSafeState {
  if (
    !row ||
    ![
      "not_connected",
      "link_created",
      "telegram_pending",
      "connected",
      "switch_required",
    ].includes(row.state)
  ) {
    return unavailableState();
  }
  return {
    state: row.state as TelegramSafeState["state"],
    linkSessionPublicId: row.link_session_public_id,
    expiresAt: row.expires_at,
    connected: Boolean(row.connected),
    activeOnThisConversation: Boolean(row.active_on_this_conversation),
    activeOnAnotherConversation: Boolean(row.active_on_another_conversation),
  };
}

export async function getMyTelegramCompanionState(publicId?: string) {
  if (
    !isTelegramCompanionEnabled() ||
    !isTelegramCompanionCryptoConfigured()
  ) {
    return unavailableState();
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_my_telegram_companion_state",
    { p_public_id: publicId ?? null },
  );
  if (error) return unavailableState();
  return mapState((data ?? [])[0] as StateRow | undefined);
}

export async function createMyTelegramLink(publicId: string) {
  if (
    !isTelegramCompanionEnabled() ||
    !isTelegramCompanionCryptoConfigured()
  ) {
    throw new Error(TELEGRAM_MESSAGE);
  }
  const token = createTelegramLinkToken();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "create_my_telegram_link_session",
    {
      p_public_id: publicId,
      p_token_hash: hashTelegramLinkToken(token),
      p_ttl_seconds: TELEGRAM_LINK_TTL_SECONDS,
    },
  );
  if (error || !(data ?? [])[0]) throw new Error(TELEGRAM_MESSAGE);
  return {
    botUrl: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(token)}`,
    expiresAt: String((data as { expires_at: string }[])[0]?.expires_at),
  };
}

export async function confirmMyTelegramBinding(
  linkSessionPublicId: string,
  confirmSwitch: boolean,
) {
  if (!isTelegramCompanionEnabled()) throw new Error(TELEGRAM_MESSAGE);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "confirm_my_telegram_binding",
    {
      p_link_session_public_id: linkSessionPublicId,
      p_confirm_switch: confirmSwitch,
    },
  );
  if (error || !(data ?? [])[0]) throw new Error(TELEGRAM_MESSAGE);
  return (data as { state: string; switched: boolean }[])[0];
}

export async function cancelMyTelegramLink(linkSessionPublicId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "cancel_my_telegram_link_session",
    { p_link_session_public_id: linkSessionPublicId },
  );
  if (error) throw new Error(TELEGRAM_MESSAGE);
}

export async function switchMyTelegramRelay(publicId: string) {
  if (!isTelegramCompanionEnabled()) throw new Error(TELEGRAM_MESSAGE);
  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_my_telegram_relay", {
    p_public_id: publicId,
  });
  if (error) throw new Error(TELEGRAM_MESSAGE);
}

export async function unlinkMyTelegramCompanion() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unlink_my_telegram_companion");
  if (error) throw new Error(TELEGRAM_MESSAGE);
}
