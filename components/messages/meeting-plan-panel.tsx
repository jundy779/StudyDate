"use client";

import {
  acknowledgeMeetingPrecheckAction,
  cancelMeetingPlanAction,
  completeMeetingPostcheckAction,
  confirmMeetingPlanAction,
  proposeMeetingPlanAction,
} from "@/app/app/messages/actions";
import type { MeetingPlanState } from "@/lib/meeting-plans/constants";
import { EVENT_VENUE_CATEGORIES } from "@/lib/events/constants";
import { useEffect, useState, useTransition } from "react";

const venueLabels: Record<(typeof EVENT_VENUE_CATEGORIES)[number], string> = {
  campus_public_area: "Area publik kampus",
  cafe: "Kafe",
  library: "Perpustakaan",
  coworking_space: "Coworking space",
  community_space: "Ruang komunitas",
  other_public_place: "Tempat publik lainnya",
};

type Props = {
  publicId: string;
  initialState: MeetingPlanState;
};

export function MeetingPlanPanel({ publicId, initialState }: Props) {
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const startsAt = state.startsAt ? new Date(state.startsAt).getTime() : null;
  const endsAt = state.expectedEndAt ? new Date(state.expectedEndAt).getTime() : null;
  const canPrecheck =
    now !== null &&
    state.status === "confirmed" &&
    startsAt !== null &&
    now >= startsAt - 24 * 60 * 60_000 &&
    endsAt !== null &&
    now <= endsAt;
  const canPostcheck =
    now !== null &&
    state.status === "confirmed" &&
    endsAt !== null &&
    now >= endsAt;

  function run(action: (formData: FormData) => Promise<MeetingPlanState>, data: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        setState(await action(data));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Rencana belum dapat diperbarui.");
      }
    });
  }

  async function sharePlan() {
    const text = `Rencana pertemuan StudyDate\n${state.venueName}, ${state.city}\n${state.startsAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short" }).format(new Date(state.startsAt)) : ""}\nBertemu hanya di tempat publik.`;
    try {
      if (navigator.share) await navigator.share({ title: "Rencana pertemuan StudyDate", text });
      else await navigator.clipboard.writeText(text);
      setMessage("Rencana lokal siap dibagikan.");
    } catch {
      setMessage("Rencana tidak dibagikan.");
    }
  }

  if (!state.planPublicId && !state.eligible) return null;

  if (!state.planPublicId) {
    return (
      <section className="rounded-2xl border border-brand-border p-5">
        <h3 className="font-heading text-xl font-semibold text-brand-navy">Rencanakan bertemu</h3>
        <p className="mt-2 text-sm leading-6 text-brand-muted">
          Ajukan tempat publik setelah kalian membuka identitas. Detail terkunci setelah diajukan.
        </p>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          action={(data) => run(proposeMeetingPlanAction, data)}
        >
          <input type="hidden" name="publicId" value={publicId} />
          <label className="text-sm font-semibold">Jenis tempat
            <select name="venueCategory" required className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-3">
              {EVENT_VENUE_CATEGORIES.map((value) => <option key={value} value={value}>{venueLabels[value]}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Nama tempat publik
            <input name="venueName" required minLength={3} maxLength={120} className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-3" />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">Area publik
            <input name="venueArea" required minLength={8} maxLength={240} className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-3" />
          </label>
          <label className="text-sm font-semibold">Kota
            <input name="city" required minLength={2} maxLength={100} className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-3" />
          </label>
          <label className="text-sm font-semibold">Zona waktu
            <select name="timezone" className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-3">
              <option value="Asia/Jakarta">WIB</option><option value="Asia/Makassar">WITA</option><option value="Asia/Jayapura">WIT</option>
            </select>
          </label>
          <label className="text-sm font-semibold">Mulai
            <input name="startsAtLocal" type="datetime-local" required className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-3" />
          </label>
          <label className="text-sm font-semibold">Perkiraan selesai
            <input name="expectedEndAtLocal" type="datetime-local" required className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-3" />
          </label>
          <fieldset className="space-y-3 sm:col-span-2">
            <legend className="text-sm font-semibold">Konfirmasi keselamatan</legend>
            {[
              ["confirmsPublicPlace", "Tempat ini publik, ramai, dan mudah diakses."],
              ["confirmsExpectedOperating", "Tempat diperkirakan masih beroperasi pada waktu tersebut."],
              ["confirmsNotPrivateResidence", "Ini bukan rumah, kos, apartemen, atau kamar pribadi."],
              ["confirmsNoPrivateLocationDisclosure", "Saya tidak memasukkan titik jemput, live location, atau alamat privat."],
            ].map(([name, label]) => <label key={name} className="flex gap-3 text-sm leading-6"><input name={name} type="checkbox" required className="focus-ring mt-1 h-5 w-5 shrink-0" />{label}</label>)}
          </fieldset>
          <button disabled={pending} className="focus-ring min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-start">
            Ajukan rencana
          </button>
        </form>
        {message ? <p role="status" className="mt-3 text-sm text-brand-muted">{message}</p> : null}
      </section>
    );
  }

  const planData = () => {
    const data = new FormData();
    data.set("publicId", publicId);
    data.set("planPublicId", state.planPublicId!);
    return data;
  };

  return (
    <section className="rounded-2xl border border-brand-border p-5">
      <h3 className="font-heading text-xl font-semibold text-brand-navy">Rencana pertemuan</h3>
      <p className="mt-2 text-sm font-semibold text-brand-blue">
        {state.status === "confirmed" ? "Sudah disetujui bersama" : state.status === "cancelled" ? "Dibatalkan" : "Menunggu konfirmasi"}
      </p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="font-semibold">Tempat publik</dt><dd className="mt-1 break-words text-brand-muted">{state.venueName}, {state.venueArea}, {state.city}</dd></div>
        <div><dt className="font-semibold">Waktu</dt><dd className="mt-1 text-brand-muted">{state.startsAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(state.startsAt)) : "Detail telah dibersihkan"}</dd></div>
      </dl>
      <div className="mt-5 flex flex-wrap gap-3">
        {state.status === "pending_confirmation" && !state.createdByMe ? (
          <button disabled={pending} onClick={() => run(confirmMeetingPlanAction, planData())} className="focus-ring min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">Konfirmasi</button>
        ) : null}
        {state.status !== "cancelled" ? (
          <button disabled={pending} onClick={() => run(cancelMeetingPlanAction, planData())} className="focus-ring min-h-11 rounded-xl border border-brand-border px-5 text-sm font-semibold">Batalkan</button>
        ) : null}
        {state.status === "confirmed" ? <button type="button" onClick={sharePlan} className="focus-ring min-h-11 rounded-xl border border-brand-border px-5 text-sm font-semibold">Bagikan rencana</button> : null}
        {canPrecheck && !state.precheckAcknowledgedAt ? (
          <button disabled={pending} onClick={() => run(acknowledgeMeetingPrecheckAction, planData())} className="focus-ring min-h-11 rounded-xl border border-brand-border px-5 text-sm font-semibold">Saya sudah meninjau rencana</button>
        ) : null}
        {canPostcheck && !state.postcheckStatus ? (
          <>
            <button onClick={() => { const data = planData(); data.set("status", "safe"); run(completeMeetingPostcheckAction, data); }} className="focus-ring min-h-11 rounded-xl border border-brand-border px-5 text-sm font-semibold">Selesai dan aman</button>
            <a href="/safety" className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-brand-border px-5 text-sm font-semibold">Laporkan / Pusat Keamanan</a>
          </>
        ) : null}
      </div>
      {message ? <p role="status" className="mt-3 text-sm text-brand-muted">{message}</p> : null}
    </section>
  );
}
