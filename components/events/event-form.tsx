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
  EVENT_VENUE_AREA_MAX,
  EVENT_VENUE_AREA_MIN,
  EVENT_VENUE_CATEGORIES,
  EVENT_VENUE_NAME_MAX,
  EVENT_VENUE_NAME_MIN,
} from "@/lib/events/constants";
import type { CampusEventDetail } from "@/lib/events/service";

const categoryLabels: Record<(typeof EVENT_CATEGORIES)[number], string> = {
  study_together: "Belajar Bareng",
  coding_tech: "Coding / Tech",
  design: "Desain",
  languages: "Bahasa",
  thesis: "Skripsi / Tesis",
  exam_prep: "Persiapan Ujian",
  workshop: "Workshop",
  discussion: "Diskusi",
  networking: "Relasi profesional",
  community: "Komunitas",
  other: "Lainnya",
};

const venueLabels: Record<(typeof EVENT_VENUE_CATEGORIES)[number], string> = {
  campus_public_area: "Area publik kampus",
  cafe: "Kafe",
  library: "Perpustakaan",
  coworking_space: "Coworking space",
  community_space: "Ruang komunitas",
  other_public_place: "Tempat publik lainnya",
};

const timezoneLabels: Record<(typeof EVENT_TIMEZONES)[number], string> = {
  "Asia/Jakarta": "WIB — Jakarta",
  "Asia/Makassar": "WITA — Makassar",
  "Asia/Jayapura": "WIT — Jayapura",
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
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  event?: CampusEventDetail;
  submitLabel: string;
}) {
  const defaults = createDefaults();
  const timezone = event?.timezone_name ?? "Asia/Jakarta";
  const startsAtLocal = event
    ? localDateTimeValue(event.starts_at, timezone)
    : defaults.startsAtLocal;
  const endsAtLocal = event
    ? localDateTimeValue(event.ends_at, timezone)
    : defaults.endsAtLocal;
  const registrationClosesAtLocal = event?.registration_closes_at
    ? localDateTimeValue(event.registration_closes_at, timezone)
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
          defaultValue={event?.title}
          aria-describedby="event-title-help"
          className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
        />
        <p id="event-title-help" className="mt-2 text-xs leading-5 text-brand-muted">
          {EVENT_TITLE_MIN}–{EVENT_TITLE_MAX} karakter, teks biasa tanpa HTML.
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
          defaultValue={event?.description}
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
            defaultValue={event?.category ?? "study_together"}
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
            defaultValue={event?.capacity ?? 12}
            className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
          />
        </div>
      </div>

      <fieldset disabled={Boolean(event)}>
        <legend className="text-sm font-semibold text-brand-navy">Cakupan</legend>
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
                  defaultChecked={(event?.scope ?? "open") === scope}
                  className="mt-1 h-4 w-4 accent-brand-blue"
                />
                <span>
                  <span className="block text-sm font-semibold text-brand-navy">
                    {scope === "open" ? "Terbuka untuk StudyDate" : "Kampus yang sama"}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-brand-muted">
                    {scope === "open"
                      ? "Mahasiswa yang memenuhi syarat dari kampus lain dapat menemukan acara."
                      : "Kampus mengikuti profil penyelenggara dan diperiksa oleh sistem."}
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
                defaultValue="instant"
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
              defaultChecked
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

      <fieldset
        disabled={event?.schedule_venue_locked}
        className="border-t border-brand-border pt-7 disabled:opacity-70"
      >
        <legend className="font-heading text-xl font-semibold text-brand-navy">
          Tempat publik
        </legend>
        <p className="mt-2 text-sm leading-6 text-brand-muted">
          Gunakan tempat publik yang ramai dan masih beroperasi. Jangan gunakan rumah,
          kamar kos, apartemen pribadi, atau kamar hotel.
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
              defaultValue={event?.venue_category ?? "campus_public_area"}
              className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
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
              Kota / wilayah publik
            </label>
            <input
              id="event-city"
              name="city"
              required
              minLength={2}
              maxLength={100}
              defaultValue={event?.city}
              className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
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
            defaultValue={event?.venue_name}
            className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
          />
        </div>
        <div className="mt-5">
          <label htmlFor="event-venue-area" className="text-sm font-semibold text-brand-navy">
            Alamat / area publik
          </label>
          <textarea
            id="event-venue-area"
            name="venueArea"
            rows={3}
            required
            minLength={EVENT_VENUE_AREA_MIN}
            maxLength={EVENT_VENUE_AREA_MAX}
            defaultValue={event?.venue_area}
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
                defaultChecked={Boolean(event)}
                className="mt-1 h-4 w-4 shrink-0 accent-brand-blue"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

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
