import { createCampusEventAction } from "@/app/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { EventForm } from "@/components/events/event-form";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { getMyEventOrganizerEligibility } from "@/lib/events/service";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

type CreateEventPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CreateEventPage({
  searchParams,
}: CreateEventPageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  const eligibility = await getMyEventOrganizerEligibility();
  if (!eligibility?.eligible) notFound();
  const params = await searchParams;
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;

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
            <p className="section-label">Buat acara kampus</p>
            <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
              Mulai kegiatan di tempat publik
            </h1>
            <p className="mt-5 text-lg leading-8 text-brand-muted">
              Kamu menjadi penyelenggara acara ini, bukan bagian dari tim internal StudyDate. Penyelenggara tidak
              mendapat akses ke identitas atau kontak privat peserta.
            </p>
          </header>

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
                submitLabel="Buat acara"
              />
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
