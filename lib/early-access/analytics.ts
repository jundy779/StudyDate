"use client";

import type { EarlyAccessSource } from "./validation";

export type EarlyAccessEventName =
  | "early_access_opened"
  | "early_access_submitted"
  | "early_access_success"
  | "early_access_duplicate"
  | "early_access_error";

export function emitEarlyAccessEvent(
  event: EarlyAccessEventName,
  source: EarlyAccessSource,
) {
  window.dispatchEvent(
    new CustomEvent("studydate:analytics", {
      detail: { event, source },
    }),
  );
}
