import "server-only";

import { createServerAdminClient } from "@/lib/supabase/admin";
import {
  isTelegramCompanionEnabled,
  sendTelegramText,
} from "@/lib/telegram/bot-api";
import {
  decryptTelegramRoute,
  normalizeTelegramBytea,
} from "@/lib/telegram/crypto";

export const TELEGRAM_DELIVERY_BATCH_SIZE = 25;

type DeliveryJob = {
  outbox_id: string;
  lease_token: string;
  route_ciphertext: unknown;
  route_iv: unknown;
  route_auth_tag: unknown;
  encryption_key_version: number;
  message_body: string;
  attempt_count: number;
};

export type TelegramDeliveryBatchResult = {
  claimed: number;
  delivered: number;
  retryScheduled: number;
  failed: number;
};

function firstRow(data: unknown) {
  return (Array.isArray(data) ? data[0] : data) as DeliveryJob | undefined;
}

export async function runTelegramDeliveryBatch(): Promise<TelegramDeliveryBatchResult> {
  if (!isTelegramCompanionEnabled()) {
    throw new Error("Telegram delivery is unavailable.");
  }
  const admin = createServerAdminClient();
  if (!admin) throw new Error("Telegram delivery is unavailable.");

  const result: TelegramDeliveryBatchResult = {
    claimed: 0,
    delivered: 0,
    retryScheduled: 0,
    failed: 0,
  };

  for (let index = 0; index < TELEGRAM_DELIVERY_BATCH_SIZE; index += 1) {
    const claim = await admin.rpc("claim_telegram_delivery");
    if (claim.error) throw new Error("Telegram delivery is unavailable.");

    const job = firstRow(claim.data);
    if (!job) break;
    result.claimed += 1;

    let delivery;
    try {
      const chatId = decryptTelegramRoute({
        ciphertext: normalizeTelegramBytea(job.route_ciphertext),
        iv: normalizeTelegramBytea(job.route_iv),
        authTag: normalizeTelegramBytea(job.route_auth_tag),
        keyVersion: job.encryption_key_version,
      });
      delivery = await sendTelegramText(
        chatId,
        `Pesan baru\n\n${job.message_body}`,
      );
    } catch {
      delivery = {
        ok: false as const,
        category: "delivery_uncertain" as const,
        permanent: false,
      };
    }

    if (delivery.ok) {
      const completion = await admin.rpc("complete_telegram_delivery", {
        p_outbox_id: job.outbox_id,
        p_lease_token: job.lease_token,
        p_telegram_message_id: delivery.messageId,
      });
      if (completion.error) throw new Error("Telegram delivery is unavailable.");
      result.delivered += 1;
      continue;
    }

    const failure = await admin.rpc("fail_telegram_delivery", {
      p_outbox_id: job.outbox_id,
      p_lease_token: job.lease_token,
      p_failure_code: delivery.category,
      p_retry_after_seconds: delivery.retryAfterSeconds ?? null,
      p_permanent: delivery.permanent,
    });
    if (failure.error) throw new Error("Telegram delivery is unavailable.");

    if (delivery.permanent || job.attempt_count >= 5) result.failed += 1;
    else result.retryScheduled += 1;
  }

  const cleanup = await admin.rpc("cleanup_telegram_companion_runtime", {
    p_limit: 500,
  });
  if (cleanup.error) throw new Error("Telegram delivery is unavailable.");

  return result;
}
