import type {
  CampusEventDetail,
  CampusEventRegistrationOverview,
} from "@/lib/events/service";

export type EventReadinessItem = {
  key: "schedule" | "listing" | "registration" | "capacity" | "decisions";
  label: string;
  detail: string;
  ready: boolean;
};

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

export function buildCampusEventReport(
  event: CampusEventDetail,
  overview: CampusEventRegistrationOverview,
  now = new Date(),
) {
  const totalRegistrations =
    overview.pending_count +
    overview.going_count +
    overview.waitlisted_count +
    overview.declined_count +
    overview.cancelled_count;
  const decidedRegistrations = overview.going_count + overview.declined_count;
  const registrationStillOpen =
    !event.registration_closes_at ||
    new Date(event.registration_closes_at).getTime() > now.getTime();
  const eventStillUpcoming =
    event.status === "scheduled" &&
    new Date(event.starts_at).getTime() > now.getTime();
  const remainingSpots = Math.max(0, event.capacity - overview.going_count);

  const readiness: EventReadinessItem[] = [
    {
      key: "schedule",
      label: "Jadwal acara",
      detail: eventStillUpcoming
        ? "Acara masih terjadwal dan belum dimulai."
        : "Periksa kembali status atau waktu mulai acara.",
      ready: eventStillUpcoming,
    },
    {
      key: "listing",
      label: "Tampil di halaman publik",
      detail:
        event.scope === "open" && event.is_official
          ? "Acara terbuka dan sudah ditandai resmi."
          : "Halaman publik hanya menampilkan acara terbuka yang sudah ditandai resmi.",
      ready: event.scope === "open" && event.is_official,
    },
    {
      key: "registration",
      label: "Pendaftaran",
      detail: registrationStillOpen
        ? "Pendaftaran masih menerima peserta sesuai aturan acara."
        : "Waktu pendaftaran sudah berakhir.",
      ready: registrationStillOpen && eventStillUpcoming,
    },
    {
      key: "capacity",
      label: "Kuota peserta",
      detail:
        remainingSpots > 0
          ? `${remainingSpots} tempat masih tersedia.`
          : event.waitlist_enabled
            ? "Kuota penuh, pendaftar baru akan masuk daftar tunggu."
            : "Kuota penuh dan daftar tunggu tidak diaktifkan.",
      ready: remainingSpots > 0 || event.waitlist_enabled,
    },
    {
      key: "decisions",
      label: "Keputusan pendaftaran",
      detail:
        event.registration_mode === "instant" || overview.pending_count === 0
          ? "Tidak ada pendaftaran yang menunggu keputusan."
          : `${overview.pending_count} pendaftaran masih perlu ditinjau.`,
      ready:
        event.registration_mode === "instant" || overview.pending_count === 0,
    },
  ];

  return {
    totalRegistrations,
    remainingSpots,
    fillRate: percentage(overview.going_count, event.capacity),
    confirmationRate: percentage(overview.going_count, totalRegistrations),
    decisionRate: percentage(
      decidedRegistrations,
      decidedRegistrations + overview.pending_count,
    ),
    attendanceRate: percentage(overview.checked_in_count, overview.going_count),
    readiness,
    readyCount: readiness.filter((item) => item.ready).length,
  };
}
