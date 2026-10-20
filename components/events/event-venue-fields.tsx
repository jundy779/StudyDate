"use client";

import { Globe2, MapPin, MonitorSmartphone } from "lucide-react";
import { useState } from "react";
import {
  EVENT_VENUE_AREA_MAX,
  EVENT_VENUE_AREA_MIN,
  EVENT_VENUE_CATEGORIES,
  EVENT_VENUE_NAME_MAX,
  EVENT_VENUE_NAME_MIN,
  type EventAttendanceMode,
} from "@/lib/events/constants";
import {
  EVENT_MEETING_URL_ERROR,
  EVENT_MEETING_URL_MAX,
  isAllowedMeetingUrl,
  meetingPlatformLabel,
} from "@/lib/events/online";

const venueLabels: Record<(typeof EVENT_VENUE_CATEGORIES)[number], string> = {
  campus_public_area: "Area publik kampus",
  cafe: "Kafe",
  library: "Perpustakaan",
  coworking_space: "Coworking space",
  community_space: "Ruang komunitas",
  other_public_place: "Tempat publik lainnya",
};

const modes: {
  value: EventAttendanceMode;
  label: string;
  help: string;
  icon: typeof MapPin;
}[] = [
  { value: "offline", label: "Tatap muka", help: "Bertemu di tempat publik.", icon: MapPin },
  { value: "online", label: "Online", help: "Lewat Zoom, Meet, dan sejenisnya.", icon: Globe2 },
  {
    value: "hybrid",
    label: "Keduanya",
    help: "Tempat publik plus link online.",
    icon: MonitorSmartphone,
  },
];

const fieldClass =
  "focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy";

export function EventVenueFields({
  initialMode,
  initialOnlineUrl,
  locked,
  editing,
  venue,
}: {
  initialMode: EventAttendanceMode;
  initialOnlineUrl: string;
  /** Waktu dan tempat dikunci setelah peserta lain mendaftar. */
  locked: boolean;
  editing: boolean;
  venue?: {
    venue_category: string;
    venue_name: string;
    venue_area: string;
    city: string;
  };
}) {
  const [mode, setMode] = useState<EventAttendanceMode>(initialMode);
  const [url, setUrl] = useState(initialOnlineUrl);
  const lockedOnline = locked && initialMode === "online";
  const availableModes = locked
    ? modes.filter((item) =>
        lockedOnline ? item.value === "online" : item.value !== "online",
      )
    : modes;
  const physical = mode !== "online";
  const physicalDefaults =
    venue && venue.venue_category !== "online" ? venue : undefined;
  const platform = url ? meetingPlatformLabel(url) : null;
  const urlInvalid = url.trim() !== "" && !isAllowedMeetingUrl(url.trim());

  return (
    <>
      <fieldset className="border-t border-brand-border pt-7">
        <legend className="font-heading text-xl font-semibold text-brand-navy">
          Cara ikut
        </legend>
        {lockedOnline ? (
          <input type="hidden" name="attendanceMode" value="online" />
        ) : null}
        <div
          className={`mt-4 grid gap-3 ${availableModes.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
        >
          {availableModes.map((item) => {
            const Icon = item.icon;
            const checked = mode === item.value;
            return (
              <label
                key={item.value}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-brand-blue focus-within:ring-offset-2 ${
                  checked
                    ? "border-brand-navy bg-[#EAF1FF] shadow-[3px_3px_0_#0F1B33]"
                    : "border-brand-border bg-white hover:border-brand-navy/40"
                }`}
              >
                <input
                  type="radio"
                  name={lockedOnline ? undefined : "attendanceMode"}
                  value={item.value}
                  checked={checked}
                  disabled={lockedOnline}
                  onChange={() => setMode(item.value)}
                  className="sr-only"
                />
                <Icon
                  className={`mt-0.5 h-5 w-5 shrink-0 ${checked ? "text-brand-blue" : "text-brand-muted"}`}
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-sm font-semibold text-brand-navy">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-brand-muted">
                    {item.help}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {mode !== "offline" ? (
          <div className="mt-5">
            <label htmlFor="event-online-url" className="text-sm font-semibold text-brand-navy">
              Link acara online
            </label>
            <input
              id="event-online-url"
              name="onlineUrl"
              type="url"
              inputMode="url"
              required
              maxLength={EVENT_MEETING_URL_MAX}
              placeholder="https://meet.google.com/abc-defg-hij"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-describedby="event-online-url-help"
              aria-invalid={urlInvalid || undefined}
              className={fieldClass}
            />
            <p
              id="event-online-url-help"
              className={`mt-2 text-xs leading-5 ${urlInvalid ? "text-brand-error" : "text-brand-muted"}`}
              aria-live="polite"
            >
              {urlInvalid
                ? EVENT_MEETING_URL_ERROR
                : platform
                  ? `Terdeteksi: ${platform}. Link hanya terlihat oleh peserta terdaftar, penyelenggara, dan tim acara.`
                  : "Link hanya terlihat oleh peserta terdaftar, penyelenggara, dan tim acara. Halaman publik tidak menampilkannya."}
            </p>
          </div>
        ) : null}
      </fieldset>

      {physical ? (
        <>
          <fieldset
            disabled={locked}
            className="border-t border-brand-border pt-7 disabled:opacity-70"
          >
            <legend className="font-heading text-xl font-semibold text-brand-navy">
              Tempat publik
            </legend>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              Gunakan tempat publik yang ramai dan masih beroperasi. Jangan gunakan
              rumah, kamar kos, apartemen pribadi, atau kamar hotel.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="event-venue-category" className="text-sm font-semibold text-brand-navy">
                  Jenis tempat
                </label>
                <select
                  id="event-venue-category"
                  name="venueCategory"
                  required
                  defaultValue={physicalDefaults?.venue_category ?? "campus_public_area"}
                  className={fieldClass}
                >
                  {EVENT_VENUE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {venueLabels[category]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="event-city" className="text-sm font-semibold text-brand-navy">
                  Kota atau wilayah
                </label>
                <input
                  id="event-city"
                  name="city"
                  required
                  minLength={2}
                  maxLength={100}
                  defaultValue={physicalDefaults?.city}
                  className={fieldClass}
                />
              </div>
            </div>
            <div className="mt-5">
              <label htmlFor="event-venue-name" className="text-sm font-semibold text-brand-navy">
                Nama tempat
              </label>
              <input
                id="event-venue-name"
                name="venueName"
                required
                minLength={EVENT_VENUE_NAME_MIN}
                maxLength={EVENT_VENUE_NAME_MAX}
                defaultValue={physicalDefaults?.venue_name}
                className={fieldClass}
              />
            </div>
            <div className="mt-5">
              <label htmlFor="event-venue-area" className="text-sm font-semibold text-brand-navy">
                Alamat atau area pertemuan
              </label>
              <textarea
                id="event-venue-area"
                name="venueArea"
                rows={3}
                required
                minLength={EVENT_VENUE_AREA_MIN}
                maxLength={EVENT_VENUE_AREA_MAX}
                defaultValue={physicalDefaults?.venue_area}
                className="focus-ring mt-2 w-full resize-y rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6 text-brand-navy"
              />
            </div>
          </fieldset>

          <fieldset className="rounded-[18px] border border-brand-border bg-brand-surface p-5">
            <legend className="px-2 font-heading text-lg font-semibold text-brand-navy">
              Konfirmasi tempat publik
            </legend>
            <p className="mt-1 text-sm leading-6 text-brand-muted">
              Konfirmasi ini membantu membatasi risiko, tetapi tidak menjamin keselamatan.
            </p>
            <div className="mt-4 space-y-3">
              {[
                ["confirmsPublicPlace", "Lokasi merupakan tempat publik."],
                ["confirmsExpectedOperating", "Tempat diperkirakan masih beroperasi saat acara."],
                ["confirmsNotPrivateResidence", "Lokasi bukan rumah atau ruang tinggal/pribadi."],
                [
                  "confirmsNoPrivateLocationDisclosure",
                  "Peserta tidak wajib membagikan lokasi privat untuk hadir.",
                ],
              ].map(([name, label]) => (
                <label key={name} className="flex items-start gap-3 text-sm leading-6 text-brand-navy">
                  <input
                    type="checkbox"
                    name={name}
                    required
                    defaultChecked={editing && Boolean(physicalDefaults)}
                    className="mt-1 h-4 w-4 shrink-0 accent-brand-blue"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : (
        <p className="rounded-[18px] border border-brand-border bg-brand-surface p-5 text-sm leading-6 text-brand-muted">
          Acara online tidak memakai lokasi fisik. Kalau nanti mau bertemu langsung,
          buat acara tatap muka terpisah di tempat publik.
        </p>
      )}
    </>
  );
}
