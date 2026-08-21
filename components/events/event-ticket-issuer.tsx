"use client";

import { issueCampusEventTicketAction } from "@/app/app/events/actions";
import type { CampusEventTicketState } from "@/lib/events/service";
import { useActionState } from "react";

type TicketState = {
  ticketToken: string | null;
  message: string | null;
};

const initialState: TicketState = {
  ticketToken: null,
  message: null,
};

export function EventTicketIssuer({
  publicSlug,
  ticketState,
}: {
  publicSlug: string;
  ticketState: CampusEventTicketState | null;
}) {
  const [state, action, pending] = useActionState(
    async (_previous: TicketState, formData: FormData): Promise<TicketState> =>
      issueCampusEventTicketAction(formData),
    initialState,
  );

  return (
    <div className="mt-4">
      {state.ticketToken ? (
        <div className="rounded-xl border border-brand-border bg-white p-4">
          <p className="text-sm text-brand-muted">{state.message}</p>
          <code className="mt-2 block break-all text-sm text-brand-navy">
            {state.ticketToken}
          </code>
        </div>
      ) : ticketState && ticketState.status !== "revoked" ? (
        <p className="text-sm text-brand-muted">
          {ticketState.status === "checked_in"
            ? "Tiket sudah digunakan untuk check-in."
            : "Tiket sudah diterbitkan. Token hanya ditampilkan satu kali saat penerbitan."}
        </p>
      ) : (
        <>
          {ticketState?.status === "revoked" ? (
            <p className="mb-3 text-sm text-brand-muted">
              Tiket sebelumnya sudah dicabut. Kamu dapat menerbitkan tiket baru untuk RSVP aktif ini.
            </p>
          ) : null}
          <form action={action}>
            <input type="hidden" name="publicSlug" value={publicSlug} />
            <button
              disabled={pending}
              className="focus-ring min-h-11 rounded-xl border border-brand-navy px-5 text-sm font-semibold text-brand-navy disabled:opacity-60"
            >
              {pending ? "Menerbitkan…" : "Terbitkan tiket"}
            </button>
          </form>
        </>
      )}
      {state.message && !state.ticketToken ? (
        <p role="alert" className="mt-3 text-sm text-brand-error">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
