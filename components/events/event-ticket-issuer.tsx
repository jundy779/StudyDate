"use client";

import { issueCampusEventTicketAction } from "@/app/app/events/actions";
import type { CampusEventTicketState } from "@/lib/events/service";
import { QRCodeSVG } from "qrcode.react";
import { useActionState } from "react";

type TicketState = {
  ticketToken: string | null;
  message: string | null;
};

const initialState: TicketState = {
  ticketToken: null,
  message: null,
};

function statusText(status: CampusEventTicketState["status"] | "ready") {
  switch (status) {
    case "ready":
    case "issued":
      return "Siap dipindai saat mencatat kehadiran.";
    case "checked_in":
      return "Sudah digunakan untuk mencatat kehadiran.";
    case "revoked":
      return "Tiket sebelumnya sudah dicabut.";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function EventTicketIssuer({
  publicSlug,
  ticketState,
  eventTitle,
  attendeeAlias,
  startsAt,
  timezone,
  venue,
}: {
  publicSlug: string;
  ticketState: CampusEventTicketState | null;
  eventTitle: string;
  attendeeAlias: string;
  startsAt: string;
  timezone: string;
  venue: string;
}) {
  const [state, action, pending] = useActionState(
    async (_previous: TicketState, formData: FormData): Promise<TicketState> =>
      issueCampusEventTicketAction(formData),
    initialState,
  );
  const hasUsableTicket = Boolean(
    ticketState && ticketState.status !== "revoked",
  );
  const displayStatus =
    ticketState?.status === "checked_in"
      ? "checked_in"
      : state.ticketToken
        ? "ready"
        : ticketState?.status ?? "ready";
  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(startsAt));

  return (
    <div className="mt-5 max-w-xl">
      {state.ticketToken ? (
        <article className="overflow-hidden rounded-[22px] border border-brand-border bg-white">
          <div className="border-b border-brand-border bg-brand-navy px-5 py-4 text-white">
            <p className="text-xs font-semibold text-blue-200">
              StudyDate ID · Tiket kehadiran
            </p>
            <h3 className="mt-2 break-words font-heading text-xl font-semibold">
              {eventTitle}
            </h3>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
            <dl className="min-w-0 space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-brand-navy">Peserta</dt>
                <dd className="mt-1 break-words text-brand-muted">{attendeeAlias}</dd>
              </div>
              <div>
                <dt className="font-semibold text-brand-navy">Tanggal</dt>
                <dd className="mt-1 break-words text-brand-muted">{formattedDate}</dd>
              </div>
              <div>
                <dt className="font-semibold text-brand-navy">Tempat publik</dt>
                <dd className="mt-1 break-words text-brand-muted">{venue}</dd>
              </div>
              <div>
                <dt className="font-semibold text-brand-navy">Status</dt>
                <dd className="mt-1 font-medium text-brand-blue">
                  {statusText(displayStatus)}
                </dd>
              </div>
            </dl>
            <div className="mx-auto rounded-2xl border border-brand-border bg-white p-2">
              <QRCodeSVG
                value={state.ticketToken}
                size={200}
                level="M"
                marginSize={4}
                title={`QR tiket ${eventTitle} untuk ${attendeeAlias}`}
                className="h-auto w-full max-w-[200px]"
              />
            </div>
          </div>
          <p className="border-t border-brand-border px-5 py-4 text-sm leading-6 text-brand-muted">
            Tunjukkan QR ini kepada petugas. Status tiket juga tertulis agar tidak
            bergantung pada QR atau warna saja.
          </p>
        </article>
      ) : hasUsableTicket ? (
        <form action={action}>
          <input type="hidden" name="publicSlug" value={publicSlug} />
          <p className="text-sm leading-6 text-brand-muted">
            {statusText(ticketState!.status)} Tampilkan kembali QR tiket di perangkat
            ini saat diperlukan.
          </p>
          <button
            disabled={pending}
            className="focus-ring mt-4 min-h-12 rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Menyiapkan QR…" : "Tampilkan QR tiket"}
          </button>
        </form>
      ) : (
        <>
          {ticketState?.status === "revoked" ? (
            <p className="mb-3 text-sm leading-6 text-brand-muted">
              Tiket sebelumnya sudah dicabut. Kamu dapat menerbitkan tiket baru untuk pendaftaran aktif ini.
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
      {state.ticketToken && displayStatus !== "checked_in" ? (
        <details className="mt-5 rounded-xl border border-brand-border bg-white p-4">
          <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-navy">
            Buat ulang QR tiket
          </summary>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            QR lama langsung tidak berlaku. Tangkapan layar tiket lama juga tidak dapat
            dipakai untuk mencatat kehadiran.
          </p>
          <form action={action} className="mt-4">
            <input type="hidden" name="publicSlug" value={publicSlug} />
            <input type="hidden" name="regenerate" value="true" />
            <button
              disabled={pending}
              className="focus-ring min-h-12 w-full rounded-xl border border-brand-error px-5 text-sm font-semibold text-brand-error disabled:opacity-60"
            >
              {pending ? "Membuat ulang…" : "Ya, buat ulang dan batalkan QR lama"}
            </button>
          </form>
        </details>
      ) : null}
      {state.message && !state.ticketToken ? (
        <p role="alert" className="mt-3 text-sm text-brand-error">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
