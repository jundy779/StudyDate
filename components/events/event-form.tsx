import {
  EVENT_CAPACITY_MAX,
  EVENT_CAPACITY_MIN,
  EVENT_CATEGORIES,
  EVENT_DESCRIPTION_MAX,
  EVENT_DESCRIPTION_MIN,
  EVENT_SCOPES,
  EVENT_TIMEZONES,
  EVENT_TITLE_MAX,
  EVENT_TITLE_MIN,
} from "@/lib/events/constants";
import type { CampusEventDetail } from "@/lib/events/service";
import { EventVenueFields } from "@/components/events/event-venue-fields";
import type {
  EventDuplicateCadence,
  EventFormDefaults,
} from "@/lib/events/duplication";

const categoryLabels: Record<(typeof EVENT_CATEGORIES)[number], string> = {
  study_together: "Belajar Bareng",
  coding_tech: "Coding / Tech",
  design: "Desain",
  languages: "Bahasa",
  thesis: "Skripsi / Tesis",
  exam_prep: "Persiapan Ujian",
  workshop: "Workshop",
  discussion: "Diskusi",
  networking: "Teman proyek dan karier",
  community: "Komunitas",
  seminar: "Seminar",
  meetup: "Meetup",
  hackathon: "Hackathon",
  other: "Lainnya",
};

const timezoneLabels: Record<(typeof EVENT_TIMEZONES)[number], string> = {
  "Asia/Jakarta": "WIB (Jakarta)",
  "Asia/Makassar": "WITA (Makassar)",
  "Asia/Jayapura": "WIT (Jayapura)",
};

function localDateTimeValue(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function createDefaults() {
  const starts = new Date(Date.now() + 24 * 60 * 60 * 1000);
  starts.setUTCMinutes(0, 0, 0);
  const ends = new Date(starts.getTime() + 2 * 60 * 60 * 1000);
  return {
    startsAtLocal: localDateTimeValue(starts.toISOString(), "Asia/Jakarta"),
    endsAtLocal: localDateTimeValue(ends.toISOString(), "Asia/Jakarta"),
  };
}

export function EventForm({
  action,
  event,
  template,
  duplicateFrom,
  duplicateCadence,
  seriesEditing = false,
  submitLabel,
  onlineUrl,
}: {
  action: (formData: FormData) => void | Promise<void>;
  event?: CampusEventDetail;
  template?: EventFormDefaults;
  duplicateFrom?: string;
  duplicateCadence?: EventDuplicateCadence;
  seriesEditing?: boolean;
  submitLabel: string;
  /** Link acara online saat ini, hanya diisi untuk penyelenggara dan cohost. */
  onlineUrl?: string | null;
}) {
  const defaults = createDefaults();
  const initial = event ?? template;
  const timezone = initial?.timezone_name ?? "Asia/Jakarta";
  const startsAtLocal = initial
    ? localDateTimeValue(initial.starts_at, timezone)
    : defaults.startsAtLocal;
  const endsAtLocal = initial
    ? localDateTimeValue(initial.ends_at, timezone)
    : defaults.endsAtLocal;
  const registrationClosesAtLocal = initial?.registration_closes_at
    ? localDateTimeValue(initial.registration_closes_at, timezone)
    : "";

  return (
    <form action={action} className="space-y-8">
      {event ? (
        <>
          <input type="hidden" name="publicSlug" value={event.public_slug} />
          <input type="hidden" name="scope" value={event.scope} />
          {event.schedule_venue_locked ? (
            <>
              <input type="hidden" name="startsAtLocal" value={startsAtLocal} />
              <input type="hidden" name="endsAtLocal" value={endsAtLocal} />
              <input type="hidden" name="timezone" value={timezone} />
              <input type="hidden" name="venueCategory" value={event.venue_category} />
              <input type="hidden" name="venueName" value={event.venue_name} />
              <input type="hidden" name="venueArea" value={event.venue_area} />
              <input type="hidden" name="city" value={event.city} />
            </>
          ) : null}
        </>
      ) : null}
      {event && seriesEditing ? (
        <fieldset className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <legend className="px-1 text-sm font-semibold text-brand-navy">
            Terapkan perubahan ke
          </legend>
          <div className="mt-3 grid gap-3">
            {[
              ["current", "Pertemuan ini saja", "Pertemuan lain tidak ikut berubah."],
              ["following", "Pertemuan ini dan setelahnya", "Jadwal berikutnya ikut bergeser dengan selisih yang sama."],
              ["all", "Semua pertemuan yang akan datang", "Pertemuan yang sudah selesai tetap tidak berubah."],
            ].map(([value, label, help]) => (
              <label key={value} className="flex items-start gap-3 rounded-lg bg-white p-3">
                <input
                  type="radio"
                  name="updateScope"
                  value={value}
                  defaultChecked={value === "current"}
                  className="mt-1 h-4 w-4 accent-brand-blue"
                />
                <span>
                  <span className="block text-sm font-semibold text-brand-navy">{label}</span>
                  <span className="mt-1 block text-xs leading-5 text-brand-muted">{help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

            {duplicateFrom ? (
        <>
          <input type="hidden" name="duplicateFrom" value={duplicateFrom} />
          <input
            type="hidden"
            name="duplicateCadence"
            value={duplicateCadence ?? "weekly"}
          />
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <label htmlFor="event-series-count" className="text-sm font-semibold text-brand-navy">
              Jumlah pertemuan
            </label>
            <select
              id="event-series-count"
              name="seriesCount"
              defaultValue="1"
              className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {count === 1 ? "1 pertemuan saja" : `${count} pertemuan`}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-brand-muted">
              Setiap pertemuan dibuat sebagai acara terpisah agar peserta, tiket,
              check-in, dan laporan tetap rapi. Periksa kembali semua tanggal setelah dibuat.
            </p>
          </div>
        </>
      ) : null}

      <div>
        <label htmlFor="event-title" className="text-sm font-semibold text-brand-navy">
          Judul acara
        </label>
        <input
          id="event-title"
          name="title"
          required
          minLength={EVENT_TITLE_MIN}
          maxLength={EVENT_TITLE_MAX}
          defaultValue={initial?.title}
          aria-describedby="event-title-help"
          className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
        />
        <p id="event-title-help" className="mt-2 text-xs leading-5 text-brand-muted">
          {EVENT_TITLE_MIN}–{EVENT_TITLE_MAX} karakter. Gunakan judul yang singkat dan jelas.
        </p>
      </div>

      <div>
        <label htmlFor="event-description" className="text-sm font-semibold text-brand-navy">
          Deskripsi
        </label>
        <textarea
          id="event-description"
          name="description"
          rows={6}
          required
          minLength={EVENT_DESCRIPTION_MIN}
          maxLength={EVENT_DESCRIPTION_MAX}
          defaultValue={initial?.description}
          aria-describedby="event-description-help"
          className="focus-ring mt-2 w-full resize-y rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-7 text-brand-navy"
        />
        <p id="event-description-help" className="mt-2 text-xs leading-5 text-brand-muted">
          Jelaskan kegiatan dan kebutuhan peserta. Jangan mencantumkan kontak atau tautan.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="event-category" className="text-sm font-semibold text-brand-navy">
            Kategori
          </label>
          <select
            id="event-category"
            name="category"
            required
            defaultValue={initial?.category ?? "study_together"}
            className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
          >
            {EVENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[category]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="event-capacity" className="text-sm font-semibold text-brand-navy">
            Kapasitas termasuk penyelenggara
          </label>
          <input
            id="event-capacity"
            name="capacity"
            type="number"
            required
            min={EVENT_CAPACITY_MIN}
            max={EVENT_CAPACITY_MAX}
            defaultValue={initial?.capacity ?? 12}
            className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
          />
        </div>
      </div>

      <fieldset disabled={Boolean(event)}>
        <legend className="text-sm font-semibold text-brand-navy">Siapa yang bisa ikut</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {EVENT_SCOPES.map((scope) => (
            <label
              key={scope}
              className="rounded-xl border border-brand-border bg-white p-4 focus-within:ring-2 focus-within:ring-brand-blue/40"
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="scope"
                  value={scope}
                  defaultChecked={(initial?.scope ?? "open") === scope}
                  className="mt-1 h-4 w-4 accent-brand-blue"
                />
                <span>
                  <span className="block text-sm font-semibold text-brand-navy">
                    {scope === "open" ? "Mahasiswa dan alumni dari kampus mana pun" : "Kampus yang sama"}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-brand-muted">
                    {scope === "open"
                      ? "Mahasiswa dan alumni dari kampus lain bisa menemukan acara ini."
                      : "Hanya pengguna dari kampus yang sama dengan penyelenggara."}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {!event ? (
        <fieldset className="border-t border-brand-border pt-7">
          <legend className="font-heading text-xl font-semibold text-brand-navy">
            Pendaftaran
          </legend>
          <p className="mt-2 text-sm leading-6 text-brand-muted">
            Pilih apakah peserta langsung dikonfirmasi atau perlu persetujuanmu.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-brand-navy">
              Cara menerima peserta
              <select
                name="registrationMode"
                defaultValue={initial?.registration_mode ?? "instant"}
                className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm"
              >
                <option value="instant">Langsung diterima</option>
                <option value="approval">Perlu persetujuan penyelenggara</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-brand-navy">
              Ditutup pada
              <input
                type="datetime-local"
                name="registrationClosesAt"
                defaultValue={registrationClosesAtLocal}
                className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm"
              />
              <span className="mt-2 block text-xs font-normal leading-5 text-brand-muted">
                Opsional dan harus sebelum waktu mulai.
              </span>
            </label>
          </div>
          <label className="mt-4 flex min-h-11 items-start gap-3 text-sm leading-6 text-brand-navy">
            <input
              type="checkbox"
              name="waitlistEnabled"
              defaultChecked={initial?.waitlist_enabled ?? true}
              className="mt-1 h-4 w-4 accent-brand-blue"
            />
            <span>Aktifkan daftar tunggu saat kapasitas penuh.</span>
          </label>
        </fieldset>
      ) : (
        <>
          <input type="hidden" name="registrationMode" value={event.registration_mode} />
          <input
            type="hidden"
            name="waitlistEnabled"
            value={event.waitlist_enabled ? "on" : "off"}
          />
          {event.registration_closes_at ? (
            <input
              type="hidden"
              name="registrationClosesAt"
              value={event.registration_closes_at}
            />
          ) : null}
        </>
      )}

      <fieldset
        disabled={event?.schedule_venue_locked}
        className="border-t border-brand-border pt-7 disabled:opacity-70"
      >
        <legend className="font-heading text-xl font-semibold text-brand-navy">
          Waktu acara
        </legend>
        <p id="event-time-help" className="mt-2 text-sm leading-6 text-brand-muted">
          Mulai minimal dua jam dan maksimal 180 hari dari sekarang. Durasi 30 menit–12 jam.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="event-start" className="text-sm font-semibold text-brand-navy">
              Mulai
            </label>
            <input
              id="event-start"
              name="startsAtLocal"
              type="datetime-local"
              required
              defaultValue={startsAtLocal}
              aria-describedby="event-time-help"
              className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-navy"
            />
          </div>
          <div>
            <label htmlFor="event-end" className="text-sm font-semibold text-brand-navy">
              Selesai
            </label>
            <input
              id="event-end"
              name="endsAtLocal"
              type="datetime-local"
              required
              defaultValue={endsAtLocal}
              aria-describedby="event-time-help"
              className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-navy"
            />
          </div>
        </div>
        <div className="mt-5 max-w-sm">
          <label htmlFor="event-timezone" className="text-sm font-semibold text-brand-navy">
            Zona waktu
          </label>
          <select
            id="event-timezone"
            name="timezone"
            required
            defaultValue={timezone}
            className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
          >
            {EVENT_TIMEZONES.map((item) => (
              <option key={item} value={item}>
                {timezoneLabels[item]}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <EventVenueFields
        initialMode={
          event?.attendance_mode ??
          (initial?.venue_category === "online" ? "online" : "offline")
        }
        initialOnlineUrl={onlineUrl ?? ""}
        locked={Boolean(event?.schedule_venue_locked)}
        editing={Boolean(event)}
        venue={initial}
      />

      {event ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          {event.schedule_venue_locked
            ? "Waktu dan lokasi dikunci karena sudah ada peserta yang mendaftar. Judul, deskripsi, kategori, dan kapasitas masih dapat diperbarui."
            : "Perubahan saat ini belum mengirim pemberitahuan kepada peserta. Waktu dan lokasi akan dikunci setelah ada peserta yang mendaftar."}
        </p>
      ) : null}

      <div className="border-t border-brand-border pt-6">
        <button
          type="submit"
          className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-blue px-6 text-sm font-semibold text-white sm:w-auto"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
