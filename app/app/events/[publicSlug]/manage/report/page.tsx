import { AppShell } from "@/components/app/app-shell";
import { EventManagementShell } from "@/components/events/event-management-shell";
import { getCampusEventManagement } from "@/lib/events/management";
import { buildCampusEventReport } from "@/lib/events/reporting";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

type EventReportPageProps = {
  params: Promise<{ publicSlug: string }>;
};

export default async function EventReportPage({ params }: EventReportPageProps) {
  const { publicSlug } = await params;
  const { event, overview } = await getCampusEventManagement(
    publicSlug,
    "registrations",
  );
  const report = buildCampusEventReport(event, overview);
  const funnel = [
    ["Semua pendaftaran", report.totalRegistrations],
    ["Terkonfirmasi", overview.going_count],
    ["Hadir", overview.checked_in_count],
  ] as const;
  const statusBreakdown = [
    ["Menunggu keputusan", overview.pending_count],
    ["Diterima", overview.going_count],
    ["Daftar tunggu", overview.waitlisted_count],
    ["Ditolak", overview.declined_count],
    ["Dibatalkan peserta", overview.cancelled_count],
  ] as const;
  const managementBase = `/app/events/${event.public_slug}/manage`;

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <EventManagementShell active="report" event={event} overview={overview}>
          <section aria-labelledby="event-report-title">
            <p className="section-label">Laporan acara</p>
            <h2
              id="event-report-title"
              className="mt-2 font-heading text-2xl font-semibold text-brand-navy"
            >
              Lihat kesiapan dan hasil acara
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-brand-muted">
              Angka di halaman ini berupa ringkasan. Nama asli, email, dan kontak
              peserta tetap tidak ditampilkan.
            </p>

            <dl className="mt-8 grid grid-cols-2 border-y border-brand-border sm:grid-cols-4">
              {[
                ["Pendaftaran", report.totalRegistrations],
                ["Konfirmasi", `${report.confirmationRate}%`],
                ["Sisa kuota", report.remainingSpots],
                ["Tingkat kehadiran", `${report.attendanceRate}%`],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`py-5 ${index % 2 ? "pl-5" : "pr-5"} sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0`}
                >
                  <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-muted">
                    {label}
                  </dt>
                  <dd className="mt-2 font-heading text-3xl font-semibold text-brand-navy">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <section aria-labelledby="registration-funnel-title">
              <div className="flex items-center gap-3">
                <UsersRound className="h-5 w-5 text-brand-blue" aria-hidden="true" />
                <h2
                  id="registration-funnel-title"
                  className="font-heading text-xl font-semibold text-brand-navy"
                >
                  Alur peserta
                </h2>
              </div>
              <div className="mt-5 divide-y divide-brand-border border-y border-brand-border">
                {funnel.map(([label, value], index) => {
                  const width =
                    index === 0
                      ? 100
                      : report.totalRegistrations
                        ? Math.round((value / report.totalRegistrations) * 100)
                        : 0;
                  return (
                    <div key={label} className="py-5">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-brand-navy">{label}</p>
                        <p className="font-heading text-xl font-semibold text-brand-navy">
                          {value}
                        </p>
                      </div>
                      <div
                        className="mt-3 h-2 overflow-hidden rounded-full bg-brand-border"
                        role="progressbar"
                        aria-label={label}
                        aria-valuemin={0}
                        aria-valuemax={report.totalRegistrations || 1}
                        aria-valuenow={value}
                      >
                        <div
                          className="h-full rounded-full bg-brand-blue"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-sm leading-6 text-brand-muted">
                Peserta yang membatalkan, ditolak, atau masih menunggu tidak dihitung
                sebagai peserta terkonfirmasi.
              </p>
            </section>

            <section aria-labelledby="readiness-title">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-5 w-5 text-brand-blue" aria-hidden="true" />
                <h2
                  id="readiness-title"
                  className="font-heading text-xl font-semibold text-brand-navy"
                >
                  Kesiapan acara
                </h2>
                <span className="ml-auto text-sm font-semibold text-brand-blue">
                  {report.readyCount}/{report.readiness.length} siap
                </span>
              </div>
              <div className="mt-5 divide-y divide-brand-border border-y border-brand-border">
                {report.readiness.map((item) => (
                  <div key={item.key} className="flex gap-4 py-5">
                    {item.ready ? (
                      <CheckCircle2
                        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertCircle
                        className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                        aria-hidden="true"
                      />
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-brand-navy">
                        {item.label}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-brand-muted">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-12 grid gap-10 border-y border-brand-border py-8 lg:grid-cols-2">
            <section aria-labelledby="registration-status-title">
              <h2
                id="registration-status-title"
                className="font-heading text-xl font-semibold text-brand-navy"
              >
                Rincian status pendaftaran
              </h2>
              <p className="mt-2 text-sm leading-6 text-brand-muted">
                Ringkasan ini membantu penyelenggara melihat antrean tanpa membuka
                data pribadi peserta.
              </p>
              <dl className="mt-5 divide-y divide-brand-border">
                {statusBreakdown.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-brand-muted">{label}</dt>
                    <dd className="font-heading text-xl font-semibold text-brand-navy">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <a
                href={`/api/events/${event.public_slug}/registrations/export`}
                className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Unduh daftar peserta CSV
              </a>
            </section>

            <section aria-labelledby="next-actions-title">
              <h2
                id="next-actions-title"
                className="font-heading text-xl font-semibold text-brand-navy"
              >
                Langkah berikutnya
              </h2>
              <p className="mt-2 text-sm leading-6 text-brand-muted">
                Pilih pekerjaan yang perlu diselesaikan sebelum acara dimulai.
              </p>
              <div className="mt-5 divide-y divide-brand-border border-y border-brand-border">
                {[
                  {
                    href: `${managementBase}/registrations`,
                    title: "Tinjau pendaftaran",
                    detail:
                      overview.pending_count > 0
                        ? `${overview.pending_count} pendaftaran masih menunggu keputusan.`
                        : "Tidak ada pendaftaran yang menunggu keputusan.",
                  },
                  {
                    href: `${managementBase}/check-in`,
                    title: "Siapkan kehadiran",
                    detail: "Buka pemindai QR dan daftar hadir manual.",
                  },
                  {
                    href: `${managementBase}/settings`,
                    title: "Periksa pengaturan",
                    detail: "Pastikan jadwal, lokasi, kuota, dan aturan pendaftaran sudah tepat.",
                  },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="focus-ring group flex min-h-20 items-center gap-4 py-4"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-brand-navy">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-brand-muted">
                        {item.detail}
                      </span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-brand-blue transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <aside className="mt-12 flex max-w-4xl gap-4 border-l-2 border-brand-blue pl-5">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-brand-navy">
                Laporan yang menjaga privasi
              </h2>
              <p className="mt-1 text-sm leading-6 text-brand-muted">
                StudyDate sengaja memakai data agregat untuk evaluasi acara. Status
                pengiriman pengingat 24 jam dan 2 jam belum ditampilkan sampai
                scheduler produksi selesai diverifikasi.
              </p>
            </div>
          </aside>
        </EventManagementShell>
      </main>
    </AppShell>
  );
}
