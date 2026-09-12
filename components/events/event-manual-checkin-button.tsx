"use client";

import { manualCheckInCampusEventRegistrationAction } from "@/app/app/events/actions";
import { useState } from "react";

export function EventManualCheckInButton({
  publicSlug,
  registrationPublicId,
}: {
  publicSlug: string;
  registrationPublicId: string;
}) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        const result = await manualCheckInCampusEventRegistrationAction(formData);
        setMessage(
          result.message ??
            (result.status === "checked_in"
              ? "Kehadiran berhasil dicatat."
              : result.status === "duplicate"
                ? "Kehadiran peserta sudah tercatat."
                : result.status === "outside_window"
                  ? "Kehadiran belum dapat dicatat pada waktu ini."
                  : "Kehadiran belum dapat dicatat."),
        );
      }}
    >
      <input type="hidden" name="publicSlug" value={publicSlug} />
      <input
        type="hidden"
        name="registrationPublicId"
        value={registrationPublicId}
      />
      <button className="focus-ring min-h-11 rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white">
        Catat kehadiran
      </button>
      {message ? (
        <p role="status" className="mt-2 max-w-xs text-xs leading-5 text-brand-muted">
          {message}
        </p>
      ) : null}
    </form>
  );
}
