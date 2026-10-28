import { requireEventFeatureAccess } from "@/lib/account/student-access";
import { createCampusEventAction } from "@/app/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { AppPage, Notice, Panel, appButton } from "@/components/app/ui";
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
      <AppPage
        kicker={source ? "Acara berikutnya" : "Buat acara kampus"}
        title={source ? "Periksa jadwal sebelum diterbitkan" : "Mulai kegiatan di tempat publik"}
        description="Kamu menjadi penyelenggara acara ini, bukan bagian dari tim internal StudyDate. Penyelenggara tidak mendapat akses ke identitas atau kontak privat peserta."
        mascot="girang"
        actions={
          <Link href="/app/events" className={appButton.quiet}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke acara kampus
          </Link>
        }
      >
        <div className="grid max-w-4xl gap-6">
          {source ? (
            <aside className="flex items-start gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-950">
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

          <aside className="flex items-start gap-3 rounded-[18px] border border-blue-100 bg-blue-50 px-5 py-4 text-sm leading-6 text-brand-navy">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
            <p>
              Pertemuan StudyDate dilakukan di tempat publik. Pastikan lokasi ramai,
              mudah diakses, dan masih beroperasi pada waktu acara.
            </p>
          </aside>

          {notice ? (
            <Notice tone="danger">{notice}</Notice>
          ) : null}

          <Panel
            id="event-create-form"
            title="Detail acara"
            description="Semua informasi di bawah dapat terlihat oleh mahasiswa yang memenuhi syarat."
          >
            <div>
              <EventForm
                action={createCampusEventAction}
                template={template}
                duplicateFrom={source?.public_slug}
                duplicateCadence={source ? cadence : undefined}
                submitLabel={source ? "Buat acara baru" : "Buat acara"}
              />
            </div>
          </Panel>
        </div>
      </AppPage>
    </AppShell>
  );
}
