import {
  lookupEventOrganizerEligibility,
  manageEventOrganizerEligibility,
  setCampusEventOfficial,
} from "@/app/owner/events/actions";
import { StaffShell } from "@/components/staff/staff-shell";
import { ownerLookupEventOrganizerEligibility } from "@/lib/events/service";
import { eventOrganizerEligibilityLookupSchema } from "@/lib/events/validation";
import { requireOwner } from "@/lib/staff/authorization";
import { Suspense } from "react";

type Props = {
  searchParams: Promise<{ alias?: string; slug?: string; state?: string }>;
};

const stateMessage: Record<string, string> = {
  eligibility_saved: "Izin organizer berhasil diperbarui.",
  eligibility_unchanged: "Status izin organizer sudah sesuai.",
  eligibility_error: "Izin organizer belum dapat diperbarui.",
  official_saved: "Status resmi Event berhasil diperbarui.",
  official_unchanged:
    "Event tidak ditemukan atau status resminya sudah sesuai. Periksa kembali slug publik.",
  official_error: "Status resmi Event belum dapat diperbarui.",
  invalid_alias: "Alias publik tidak valid.",
  invalid_slug: "Slug publik Event tidak valid.",
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
  const organizer = alias.success
    ? await ownerLookupEventOrganizerEligibility(alias.data.publicAlias)
    : null;
  const message = query.state ? stateMessage[query.state] : null;

  return (
    <StaffShell role={access.role} current="events" access={access}>
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Khusus Owner</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">
            Operasional Campus Events
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-brand-muted">
            Kelola kepercayaan organizer dan penanda Event resmi menggunakan
            identifier publik yang aman. Perubahan diputuskan kembali oleh server.
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

          <section className="mt-10 border-y border-brand-border py-8">
            <h2 className="font-heading text-2xl font-semibold text-brand-navy">
              Izin organizer
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
              Cari alias publik secara exact. StudyDate Plus menambah kapasitas
              produk, tetapi tidak memberi kepercayaan organizer. Mahasiswa dapat
              menjadi organizer karena terverifikasi atau mendapat grant Owner.
            </p>

            <form
              action={lookupEventOrganizerEligibility}
              className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
            >
              <label className="text-sm font-semibold">
                Alias publik mahasiswa
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
                Cari alias
              </button>
            </form>

            {aliasInput && alias.success && !organizer ? (
              <p className="mt-6 text-sm text-brand-muted">
                Tidak ada mahasiswa non-staff dengan alias publik tersebut.
              </p>
            ) : null}

            {organizer ? (
              <div className="mt-7 bg-white p-6 sm:p-7">
                <div className="grid gap-5 border-b border-brand-border pb-6 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-muted">
                      Alias publik
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
                    <dt className="text-sm text-brand-muted">Status eksplisit Owner</dt>
                    <dd className="mt-1 font-semibold text-brand-navy">
                      {organizer.eligibility_status === "eligible"
                        ? "Diberi izin"
                        : organizer.eligibility_status === "revoked"
                          ? "Dicabut"
                          : "Belum diatur"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-brand-muted">Izin efektif</dt>
                    <dd className="mt-1 font-semibold text-brand-navy">
                      {organizer.effective_eligible ? "Memenuhi syarat" : "Tidak memenuhi syarat"}
                    </dd>
                  </div>
                </dl>
                <p className="border-t border-brand-border pt-5 text-sm leading-6 text-brand-muted">
                  Status dicabut oleh Owner selalu menonaktifkan izin organizer,
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
                      Beri izin organizer
                    </button>
                  </form>
                  <form action={manageEventOrganizerEligibility}>
                    <input
                      type="hidden"
                      name="publicAlias"
                      value={organizer.public_alias}
                    />
                    <input type="hidden" name="action" value="revoke" />
                    <button className="focus-ring min-h-11 rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-navy">
                      Cabut izin organizer
                    </button>
                  </form>
                </div>
              </div>
            ) : null}
          </section>

          <section className="py-8">
            <h2 className="font-heading text-2xl font-semibold text-brand-navy">
              Penanda Event resmi
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
              Masukkan slug publik Event secara exact. Belum ada listing operasional
              Owner, jadi halaman ini tidak membuat daftar Event semu. Server
              menentukan Event yang diubah dan menolak slug yang tidak sesuai.
            </p>
            <form
              action={setCampusEventOfficial}
              className="mt-6 grid gap-4 border-l-4 border-brand-blue bg-white p-6 sm:grid-cols-[1fr_auto] sm:items-end"
            >
              <label className="text-sm font-semibold">
                Slug publik Event
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
                <button
                  name="isOfficial"
                  value="false"
                  className="focus-ring min-h-11 rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-navy"
                >
                  Hapus tanda resmi
                </button>
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
            Menyiapkan operasional Campus Events…
          </p>
        </main>
      }
    >
      <OwnerEventsContent {...props} />
    </Suspense>
  );
}
