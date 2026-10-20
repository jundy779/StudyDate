import { requireEventFeatureAccess } from "@/lib/account/student-access";
import { createCampusEventAction } from "@/app/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { EventForm } from "@/components/events/event-form";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  buildEventDuplicateDefaults,
  parseEventDuplicateCadence,
} from "@/lib/events/duplication";
import { getCampusEventManagement } from "@/lib/events/management";
import { getMyEventOrganizerEligibility } from "@/lib/events/service";
import { ArrowLeft, CopyPlus, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

type CreateEventPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CreateEventPage({
  searchParams,
}: CreateEventPageProps) {
  await requireEventFeatureAccess();
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  const eligibility = await getMyEventOrganizerEligibility();
  if (!eligibility?.eligible) notFound();
  const params = await searchParams;
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const duplicate = Array.isArray(params.duplicate)
    ? params.duplicate[0]
    : params.duplicate;
  const cadence = parseEventDuplicateCadence(
    Array.isArray(params.cadence) ? params.cadence[0] : params.cadence,
  );
  const source = duplicate
    ? (await getCampusEventManagement(duplicate, "team")).event
    : null;
  const template = source
    ? buildEventDuplicateDefaults(source, new Date(), cadence)
    : undefined;
  const cadenceLabel = cadence === "monthly" ? "bulanan" : "mingguan";

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell max-w-4xl py-8 sm:py-12 lg:py-16">
          <Link
            href="/app/events"
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-brand-muted hover:text-brand-blue"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke acara kampus
          </Link>
          <header className="mt-7 max-w-2xl">
            <p className="section-label">
              {source ? "Acara berikutnya" : "Buat acara kampus"}
            </p>
            <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
              {source ? "Periksa jadwal sebelum diterbitkan" : "Mulai kegiatan di tempat publik"}
            </h1>
            <p className="mt-5 text-lg leading-8 text-brand-muted">
              Kamu menjadi penyelenggara acara ini, bukan bagian dari tim internal StudyDate. Penyelenggara tidak
              mendapat akses ke identitas atau kontak privat peserta.
            </p>
          </header>

          {source ? (
            <aside className="mt-7 flex items-start gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-950">
              <CopyPlus className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Detail dasar sudah disiapkan.</p>
                <p className="mt-1">
                  Jadwal disarankan ke pertemuan {cadenceLabel} berikutnya. Periksa
                  kembali tanggalnya sebelum membuat acara. Peserta, tim, tiket,
                  pertanyaan, percakapan, dan riwayat acara lama tidak ikut disalin.
                </p>
              </div>
            </aside>
          ) : null}

          <aside className="mt-7 flex items-start gap-3 rounded-[18px] border border-blue-100 bg-blue-50 px-5 py-4 text-sm leading-6 text-brand-navy">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
            <p>
              Pertemuan StudyDate dilakukan di tempat publik. Pastikan lokasi ramai,
              mudah diakses, dan masih beroperasi pada waktu acara.
            </p>
          </aside>

          {notice ? (
            <p
              role="alert"
              className="mt-7 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-brand-error"
            >
              {notice}
            </p>
          ) : null}

          <section
            aria-labelledby="event-create-form-title"
            className="mt-8 rounded-[22px] border border-brand-border bg-white p-5 sm:p-8"
          >
            <h2
              id="event-create-form-title"
              className="font-heading text-2xl font-semibold text-brand-navy"
            >
              Detail acara
            </h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              Semua informasi di bawah dapat terlihat oleh mahasiswa yang memenuhi syarat.
            </p>
            <div className="mt-7">
              <EventForm
                action={createCampusEventAction}
                template={template}
                duplicateFrom={source?.public_slug}
                duplicateCadence={source ? cadence : undefined}
                submitLabel={source ? "Buat acara baru" : "Buat acara"}
              />
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
