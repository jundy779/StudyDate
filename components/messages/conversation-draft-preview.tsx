"use client";

import {
  getChatDraftStorageKey,
  readChatDraft,
} from "@/lib/messages/drafts";
import { useEffect, useState } from "react";

type ConversationDraftPreviewProps = {
  publicId: string;
  fallback: string;
};

export function ConversationDraftPreview({
  publicId,
  fallback,
}: ConversationDraftPreviewProps) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const refresh = () => {
      setDraft(readChatDraft(window.localStorage, publicId));
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === getChatDraftStorageKey(publicId)) refresh();
    };
    const handleVisibility = () => {
      if (!document.hidden) refresh();
    };

    refresh();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [publicId]);

  return draft ? (
    <>
      <span className="font-semibold text-brand-blue">Draf:</span>{" "}
      {draft.trim()}
    </>
  ) : (
    <>{fallback}</>
  );
}
