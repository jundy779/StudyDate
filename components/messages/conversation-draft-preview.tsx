"use client";

import {
  getChatDraftStorageKey,
  peekChatDraft,
} from "@/lib/messages/drafts";
import { useCallback, useSyncExternalStore } from "react";

type ConversationDraftPreviewProps = {
  publicId: string;
  fallback: string;
};

export function ConversationDraftPreview({
  publicId,
  fallback,
}: ConversationDraftPreviewProps) {
  const getSnapshot = useCallback(
    () => peekChatDraft(window.localStorage, publicId),
    [publicId],
  );
  const subscribe = useCallback(
    (notify: () => void) => {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === getChatDraftStorageKey(publicId)) notify();
      };
      const handleVisibility = () => {
        if (!document.hidden) notify();
      };

      window.addEventListener("storage", handleStorage);
      window.addEventListener("pageshow", notify);
      document.addEventListener("visibilitychange", handleVisibility);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("pageshow", notify);
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    },
    [publicId],
  );
  const draft = useSyncExternalStore(subscribe, getSnapshot, () => "");

  return draft ? (
    <>
      <span className="font-semibold text-brand-blue">Draf:</span>{" "}
      {draft.trim()}
    </>
  ) : (
    <>{fallback}</>
  );
}
