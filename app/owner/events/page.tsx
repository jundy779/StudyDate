import {
  lookupEventOrganizerEligibility,
  manageEventOrganizerEligibility,
  setCampusEventOfficial,
} from "@/app/owner/events/actions";
import { OwnerEventDirectory } from "@/components/events/owner-event-directory";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { StaffShell } from "@/components/staff/staff-shell";
import {
  EmptyState,
  Notice,
  Panel,
  StaffPage,
  StatusChip,
  staffButton,
  staffField,
  staffLabel,
} from "@/components/staff/ui";
import { ownerLookupEventOrganizerEligibility } from "@/lib/events/service";
import { listStaffCampusEvents } from "@/lib/events/staff-service";
import { eventOrganizerEligibilityLookupSchema } from "@/lib/events/validation";
import { requireOwner } from "@/lib/staff/authorization";
import { Suspense } from "react";

type Props = {
  searchParams: Promise<{ alias?: string; slug?: string; state?: string }>;
};

const stateMessage: Record<string, string> = {
  eligibility_saved: "Izin penyelenggara berhasil diperbarui.",
  eligibility_unchanged: "Status izin penyelenggara sudah sesuai.",
  eligibility_error: "Izin penyelenggara belum dapat diperbarui.",
  official_saved: "Status resmi acara berhasil diperbarui.",
  official_unchanged:
    "Acara tidak ditemukan atau status resminya sudah sesuai. Periksa kembali alamat acara.",
  official_error: "Status resmi acara belum dapat diperbarui.",
  invalid_alias: "Nama samaran mahasiswa tidak valid.",
  invalid_slug: "Alamat acara tidak valid.",
};

const errorStates = new Set([
  "eligibility_error",
  "official_error",
  "invalid_alias",
  "invalid_slug",
]);

async function OwnerEventsContent({ searchParams }: Props) {
  const access = await requireOwner();
  const query = await searchParams;
  const aliasInput = query.alias?.trim() ?? "";
  const alias = eventOrganizerEligibilityLookupSchema.safeParse({
    publicAlias: aliasInput,
  });
  const [organizer, events] = await Promise.all([
    alias.success
      ? ownerLookupEventOrganizerEligibility(alias.data.publicAlias)
      : Promise.resolve(null),
    listStaffCampusEvents("all").catch(() => []),
  ]);
  const message = query.state ? stateMessage[query.state] : null;

  return (
    <StaffShell role={access.role} current="events" access={access}>
      <StaffPage
        kicker="Khusus Owner"
        title="Acara Kampus"
        description="Atur siapa yang boleh membuat acara dan tandai acara resmi tanpa membuka data pribadi mahasiswa. Setiap perubahan penting tetap tercatat."
        mascot="girang"
      >
        {message ? (
          <Notice tone={query.state && errorStates.has(query.state) ? "danger" : "success"}>{message}</Notice>
        ) : null}

        <OwnerEventDirectory events={events} />

        <Panel
          title="Izin penyelenggara"
          description="Masukkan nama samaran mahasiswa dengan tepat. Paket Plus menambah batas penggunaan, tetapi tidak otomatis memberi izin membuat acara. Izin diberikan kepada akun terverifikasi atau langsung oleh Owner."
        >
          <form action={lookupEventOrganizerEligibility} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className={staffLabel}>
              Nama samaran mahasiswa
              <input
                name="publicAlias"
                required
                maxLength={80}
                defaultValue={aliasInput}
                autoComplete="off"
                placeholder="Contoh: Partner #100001"
                className={staffField}
              />
            </label>
            <button className={staffButton.primary}>Cari mahasiswa</button>
          </form>

          {aliasInput && alias.success && !organizer ? (
            <div className="mt-5">
              <EmptyState title="Mahasiswa tidak ditemukan" expression="kaget">
                Tidak ada mahasiswa di luar tim StudyDate dengan nama samaran tersebut.
              </EmptyState>
            </div>
          ) : null}

          {organizer ? (
            <div className="mt-6 rounded-2xl border border-brand-border p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-xl font-semibold text-brand-navy">{organizer.public_alias}</p>
                  <p className="mt-1 text-sm text-brand-muted">
                    {organizer.campus} · {organizer.study_program}
                  </p>
                </div>
                <StatusChip tone={organizer.effective_eligible ? "go" : "muted"}>
                  {organizer.effective_eligible ? "Boleh membuat acara" : "Belum boleh membuat acara"}
                </StatusChip>
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-brand-surface px-4 py-3">
                  <dt className="text-sm text-brand-muted">Verifikasi</dt>
                  <dd className="mt-1 font-semibold text-brand-navy">
                    {organizer.is_verified ? "Terverifikasi" : "Belum terverifikasi"}
                  </dd>
                </div>
                <div className="rounded-xl bg-brand-surface px-4 py-3">
                  <dt className="text-sm text-brand-muted">Keputusan Owner</dt>
                  <dd className="mt-1 font-semibold text-brand-navy">
                    {organizer.eligibility_status === "eligible"
                      ? "Diberi izin"
                      : organizer.eligibility_status === "revoked"
                        ? "Dicabut"
                        : "Belum diatur"}
                  </dd>
                </div>
                <div className="rounded-xl bg-brand-surface px-4 py-3">
                  <dt className="text-sm text-brand-muted">Hasil akhir</dt>
                  <dd className="mt-1 font-semibold text-brand-navy">
                    {organizer.effective_eligible ? "Boleh membuat acara" : "Belum boleh membuat acara"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm leading-6 text-brand-muted">
                Status dicabut oleh Owner selalu menonaktifkan izin penyelenggara, termasuk untuk akun
                terverifikasi, sampai izin diberikan kembali.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={manageEventOrganizerEligibility}>
                  <input type="hidden" name="publicAlias" value={organizer.public_alias} />
                  <input type="hidden" name="action" value="grant" />
                  <button className={staffButton.primary}>Beri izin penyelenggara</button>
                </form>
                <form action={manageEventOrganizerEligibility}>
                  <input type="hidden" name="publicAlias" value={organizer.public_alias} />
                  <input type="hidden" name="action" value="revoke" />
                  <ConfirmSubmitButton
                    triggerLabel="Cabut izin penyelenggara"
                    title="Cabut izin penyelenggara?"
                    description="Mahasiswa ini tidak akan bisa membuat acara sampai Owner memberikan izin lagi."
                    confirmLabel="Ya, cabut izin"
                    className={staffButton.dangerQuiet}
                  />
                </form>
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Penanda acara resmi"
          description="Gunakan daftar acara di atas untuk mengubah status dengan cepat. Kalau acaranya tidak terlihat, masukkan bagian terakhir dari alamat halaman acara, misalnya event-1234 pada studydate.id/events/event-1234."
          quiet
        >
          <form action={setCampusEventOfficial} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className={staffLabel}>
              Kode dari alamat acara
              <input
                name="publicSlug"
                required
                pattern="event-[0-9a-f]{24}"
                maxLength={30}
                defaultValue={query.slug?.trim() ?? ""}
                autoComplete="off"
                placeholder="event-..."
                className={`${staffField} font-mono`}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button name="isOfficial" value="true" className={staffButton.primary}>
                Tandai resmi
              </button>
              <ConfirmSubmitButton
                triggerLabel="Hapus tanda resmi"
                title="Hapus tanda resmi?"
                description="Acara ini tidak lagi ditampilkan sebagai acara resmi StudyDate."
                confirmLabel="Ya, hapus tanda"
                name="isOfficial"
                value="false"
                className={staffButton.dangerQuiet}
              />
            </div>
          </form>
        </Panel>
      </StaffPage>
    </StaffShell>
  );
}

export default function OwnerEventsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan halaman Acara Kampus...
          </p>
        </main>
      }
    >
      <OwnerEventsContent {...props} />
    </Suspense>
  );
}
