import { StaffShell } from "@/components/staff/staff-shell";
import { requireOwner } from "@/lib/staff/authorization";
import Link from "next/link";
import { Suspense } from "react";

async function ModerationContent() {
  const access = await requireOwner();
  return (
    <StaffShell role={access.role} current="moderation">
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Owner only</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Moderasi laporan
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-muted">
            Laporan peserta sudah dapat dikirim. Antrean triage dengan status
            terkontrol menunggu migrasi database terpisah — tidak ada akses chat
            atau Contact Reveal untuk moderator di halaman ini.
          </p>

          <section
            className="mt-10 rounded-[22px] border border-brand-border bg-white p-6"
            aria-labelledby="moderation-blocked"
          >
            <h2
              id="moderation-blocked"
              className="font-heading text-xl font-semibold text-brand-navy"
            >
              Triage belum aktif di database
            </h2>
            <p className="mt-3 text-sm leading-6 text-brand-muted">
              Tabel <span className="font-mono text-xs">user_reports</span> saat
              ini hanya menyimpan pengajuan. Kolom status (
              <span className="font-mono text-xs">submitted</span> →{" "}
              <span className="font-mono text-xs">under_review</span> →{" "}
              <span className="font-mono text-xs">resolved</span> /{" "}
              <span className="font-mono text-xs">dismissed</span>), catatan
              internal, dan RPC Owner belum tersedia di project yang sudah
              di-deploy through migration 007.
            </p>
            <p className="mt-3 text-sm leading-6 text-brand-muted">
              Jangan mengasumsikan laporan sudah ditinjau hanya karena halaman
              ini terbuka. Ikuti SOP dan ajukan preflight migrasi sebelum
              limited rollout mengandalkan triage in-app.
            </p>
            <ul className="mt-6 list-disc space-y-2 pl-5 text-sm leading-6 text-brand-navy">
              <li>
                SOP:{" "}
                <span className="font-mono text-xs">
                  docs/operations/moderation-triage.md
                </span>
              </li>
              <li>
                Preflight migrasi:{" "}
                <span className="font-mono text-xs">
                  docs/operations/moderation-triage-migration-preflight.md
                </span>
              </li>
            </ul>
          </section>

          <p className="mt-8">
            <Link
              href="/owner"
              className="focus-ring text-sm font-semibold text-brand-blue underline-offset-4 hover:underline"
            >
              Kembali ke Owner workspace
            </Link>
          </p>
        </div>
      </main>
    </StaffShell>
  );
}

export default function OwnerModerationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan moderasi…
          </p>
        </main>
      }
    >
      <ModerationContent />
    </Suspense>
  );
}
