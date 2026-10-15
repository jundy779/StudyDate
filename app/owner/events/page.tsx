import {
  lookupEventOrganizerEligibility,
  manageEventOrganizerEligibility,
  setCampusEventOfficial,
} from "@/app/owner/events/actions";
import { OwnerEventDirectory } from "@/components/events/owner-event-directory";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { StaffShell } from "@/components/staff/staff-shell";
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
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Khusus owner</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">
            Operasional acara kampus
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-brand-muted">
            Atur siapa yang boleh membuat acara dan tandai acara resmi tanpa
            membuka data pribadi mahasiswa. Setiap perubahan penting tetap tercatat.
          </p>

          {message ? (
            <p
              role="status"
              className={`mt-6 rounded-xl px-4 py-3 text-sm font-semibold ${
                query.state && errorStates.has(query.state)
                  ? "bg-red-50 text-brand-error"
                  : "bg-green-50 text-brand-success"
              }`}
            >
              {message}
            </p>
          ) : null}

          <OwnerEventDirectory events={events} />

          <section className="mt-10 border-y border-brand-border py-8">
            <h2 className="font-heading text-2xl font-semibold text-brand-navy">
              Izin penyelenggara
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
              Masukkan nama samaran mahasiswa dengan tepat. Paket Plus menambah batas
              penggunaan, tetapi tidak otomatis memberi izin membuat acara. Izin diberikan
              kepada akun terverifikasi atau langsung oleh Owner.
            </p>

            <form
              action={lookupEventOrganizerEligibility}
              className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
            >
              <label className="text-sm font-semibold">
                Nama samaran mahasiswa
                <input
                  name="publicAlias"
                  required
                  maxLength={80}
                  defaultValue={aliasInput}
                  autoComplete="off"
                  placeholder="Contoh: Partner #100001"
                  className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-4 text-sm"
                />
              </label>
              <button className="focus-ring min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">
                Cari mahasiswa
              </button>
            </form>

            {aliasInput && alias.success && !organizer ? (
              <p className="mt-6 text-sm text-brand-muted">
                Tidak ada mahasiswa di luar tim StudyDate dengan nama samaran tersebut.
              </p>
            ) : null}

            {organizer ? (
              <div className="mt-7 bg-white p-6 sm:p-7">
                <div className="grid gap-5 border-b border-brand-border pb-6 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-muted">
                      Nama samaran
                    </p>
                    <p className="mt-2 font-heading text-xl font-semibold text-brand-navy">
                      {organizer.public_alias}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-muted">
                      Akademik
                    </p>
                    <p className="mt-2 font-semibold text-brand-navy">
                      {organizer.campus}
                    </p>
                    <p className="mt-1 text-sm text-brand-muted">
                      {organizer.study_program}
                    </p>
                  </div>
                </div>
                <dl className="grid gap-5 py-6 sm:grid-cols-3">
                  <div>
                    <dt className="text-sm text-brand-muted">Verifikasi</dt>
                    <dd className="mt-1 font-semibold text-brand-navy">
                      {organizer.is_verified ? "Terverifikasi" : "Belum terverifikasi"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-brand-muted">Keputusan Owner</dt>
                    <dd className="mt-1 font-semibold text-brand-navy">
                      {organizer.eligibility_status === "eligible"
                        ? "Diberi izin"
                        : organizer.eligibility_status === "revoked"
                          ? "Dicabut"
                          : "Belum diatur"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-brand-muted">Hasil akhir</dt>
                    <dd className="mt-1 font-semibold text-brand-navy">
                      {organizer.effective_eligible ? "Boleh membuat acara" : "Belum boleh membuat acara"}
                    </dd>
                  </div>
                </dl>
                <p className="border-t border-brand-border pt-5 text-sm leading-6 text-brand-muted">
                  Status dicabut oleh Owner selalu menonaktifkan izin penyelenggara,
                  termasuk untuk akun terverifikasi, sampai izin diberikan kembali.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <form action={manageEventOrganizerEligibility}>
                    <input
                      type="hidden"
                      name="publicAlias"
                      value={organizer.public_alias}
                    />
                    <input type="hidden" name="action" value="grant" />
                    <button className="focus-ring min-h-11 rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white">
                      Beri izin penyelenggara
                    </button>
                  </form>
                  <form action={manageEventOrganizerEligibility}>
                    <input
                      type="hidden"
                      name="publicAlias"
                      value={organizer.public_alias}
                    />
                    <input type="hidden" name="action" value="revoke" />
                    <ConfirmSubmitButton
                      triggerLabel="Cabut izin penyelenggara"
                      title="Cabut izin penyelenggara?"
                      description="Mahasiswa ini tidak akan bisa membuat acara sampai Owner memberikan izin lagi."
                      confirmLabel="Ya, cabut izin"
                      className="focus-ring min-h-11 rounded-xl border border-brand-error bg-white px-5 text-sm font-semibold text-brand-error"
                    />
                  </form>
                </div>
              </div>
            ) : null}
          </section>

          <section className="py-8">
            <h2 className="font-heading text-2xl font-semibold text-brand-navy">
              Penanda acara resmi
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
              Gunakan daftar acara di atas untuk mengubah status dengan cepat. Jika
              acaranya tidak terlihat, masukkan bagian terakhir dari alamat halaman
              acara. Contohnya seperti event-1234 pada studydate.id/events/event-1234.
            </p>
            <form
              action={setCampusEventOfficial}
              className="mt-6 grid gap-4 border-l-4 border-brand-blue bg-white p-6 sm:grid-cols-[1fr_auto] sm:items-end"
            >
              <label className="text-sm font-semibold">
                Kode dari alamat acara
                <input
                  name="publicSlug"
                  required
                  pattern="event-[0-9a-f]{24}"
                  maxLength={30}
                  defaultValue={query.slug?.trim() ?? ""}
                  autoComplete="off"
                  placeholder="event-…"
                  className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 font-mono text-sm"
                />
              </label>
              <div className="grid gap-3">
                <button
                  name="isOfficial"
                  value="true"
                  className="focus-ring min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
                >
                  Tandai resmi
                </button>
                <ConfirmSubmitButton
                  triggerLabel="Hapus tanda resmi"
                  title="Hapus tanda resmi?"
                  description="Acara ini tidak lagi ditampilkan sebagai acara resmi StudyDate."
                  confirmLabel="Ya, hapus tanda"
                  name="isOfficial"
                  value="false"
                  className="focus-ring min-h-11 rounded-xl border border-brand-error bg-white px-5 text-sm font-semibold text-brand-error"
                />
              </div>
            </form>
          </section>
        </div>
      </main>
    </StaffShell>
  );
}

export default function OwnerEventsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan operasional acara kampus…
          </p>
        </main>
      }
    >
      <OwnerEventsContent {...props} />
    </Suspense>
  );
}
