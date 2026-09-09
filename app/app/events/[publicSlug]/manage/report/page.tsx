import { AppShell } from "@/components/app/app-shell";
import { EventManagementShell } from "@/components/events/event-management-shell";
import { getCampusEventManagement } from "@/lib/events/management";
import { buildCampusEventReport } from "@/lib/events/reporting";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

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
                ["Kuota terisi", `${report.fillRate}%`],
                ["Keputusan selesai", `${report.decisionRate}%`],
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
