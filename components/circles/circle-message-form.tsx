"use client";

import { sendCircleMessageAction } from "@/app/app/circles/actions";
import {
  CIRCLE_CONTACT_MESSAGE,
  CIRCLE_MESSAGE_MAX,
} from "@/lib/circles/constants";
import { Send } from "lucide-react";
import { useEffect, useState } from "react";

export function CircleMessageForm({ publicSlug }: { publicSlug: string }) {
  const [body, setBody] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID().replaceAll("-", ""));
  }, []);

  return (
    <form action={sendCircleMessageAction} className="border-t border-brand-border pt-5">
      <input type="hidden" name="publicSlug" value={publicSlug} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label htmlFor="circle-message" className="text-sm font-semibold text-brand-navy">
        Tulis pesan
      </label>
      <textarea
        id="circle-message"
        name="body"
        required
        rows={4}
        maxLength={CIRCLE_MESSAGE_MAX}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-describedby="circle-message-help circle-message-count"
        placeholder="Bagikan pertanyaan atau progres belajar kalian."
        className="focus-ring mt-2 w-full resize-y rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm leading-6 text-brand-navy"
      />
      <div className="mt-2 flex flex-col gap-2 text-xs leading-5 text-brand-muted sm:flex-row sm:items-start sm:justify-between">
        <p id="circle-message-help">{CIRCLE_CONTACT_MESSAGE}</p>
        <p id="circle-message-count" aria-live="polite" className="shrink-0">
          {body.length}/{CIRCLE_MESSAGE_MAX}
        </p>
      </div>
      <button
        type="submit"
        disabled={!idempotencyKey}
        className="focus-ring mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        Kirim ke Circle
      </button>
    </form>
  );
}
