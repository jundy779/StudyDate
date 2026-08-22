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
              ? "Check-in dicatat."
              : result.status === "duplicate"
                ? "Peserta sudah check-in."
                : result.status === "outside_window"
                  ? "Check-in belum berada dalam jendela waktu."
                  : "Check-in belum dapat diproses."),
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
        Check in
      </button>
      {message ? (
        <p role="status" className="mt-2 max-w-xs text-xs leading-5 text-brand-muted">
          {message}
        </p>
      ) : null}
    </form>
  );
}
