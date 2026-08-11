import "server-only";

import { z } from "zod";

const responseSchema = z.object({
  ok: z.boolean(),
  result: z
    .object({
      message_id: z.number().int().positive(),
    })
    .passthrough()
    .optional(),
  error_code: z.number().int().optional(),
  parameters: z
    .object({
      retry_after: z.number().int().positive().optional(),
    })
    .optional(),
});

export type TelegramDeliveryResult =
  | { ok: true; messageId: number }
  | {
      ok: false;
      category:
        | "rate_limited"
        | "telegram_unavailable"
        | "delivery_rejected"
        | "delivery_uncertain";
      retryAfterSeconds?: number;
      permanent: boolean;
    };

export function isTelegramCompanionEnabled(
  env: NodeJS.ProcessEnv = process.env,
) {
  return env.TELEGRAM_COMPANION_ENABLED === "true";
}

export function hasTelegramBotConfiguration(
  env: NodeJS.ProcessEnv = process.env,
) {
  return Boolean(
    env.TELEGRAM_BOT_TOKEN?.trim() &&
      env.TELEGRAM_WEBHOOK_SECRET?.trim().length &&
      isTelegramCompanionEnabled(env),
  );
}

export async function sendTelegramText(
  chatId: string,
  text: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<TelegramDeliveryResult> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !isTelegramCompanionEnabled(env)) {
    return {
      ok: false,
      category: "telegram_unavailable",
      permanent: false,
    };
  }

  let response: Response;
  try {
    response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          link_preview_options: { is_disabled: true },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    return {
      ok: false,
      category: "delivery_uncertain",
      permanent: false,
    };
  }

  const raw = await response.text().catch(() => "");
  if (new TextEncoder().encode(raw).byteLength > 32_768) {
    return {
      ok: false,
      category: "telegram_unavailable",
      permanent: false,
    };
  }
  const parsed = responseSchema.safeParse(
    (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })(),
  );

  if (response.ok && parsed.success && parsed.data.ok && parsed.data.result) {
    return { ok: true, messageId: parsed.data.result.message_id };
  }
  if (response.status === 429) {
    return {
      ok: false,
      category: "rate_limited",
      retryAfterSeconds: parsed.success
        ? parsed.data.parameters?.retry_after
        : undefined,
      permanent: false,
    };
  }
  if (response.status >= 500) {
    return {
      ok: false,
      category: "telegram_unavailable",
      permanent: false,
    };
  }
  return {
    ok: false,
    category: "delivery_rejected",
    permanent: true,
  };
}
