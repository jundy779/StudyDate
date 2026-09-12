import type { LinkedInVerificationStatus } from "@/lib/verification/linkedin";
import { CheckCircle2, Circle, Linkedin, ShieldCheck } from "lucide-react";

function Signal({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const Icon = active ? CheckCircle2 : Circle;
  return (
    <li className="flex items-start gap-3 text-sm leading-6">
      <Icon
        className={`mt-0.5 h-5 w-5 shrink-0 ${
          active ? "text-brand-blue" : "text-brand-muted"
        }`}
        aria-hidden="true"
      />
      <span className={active ? "font-medium text-brand-navy" : "text-brand-muted"}>
        {children}
      </span>
    </li>
  );
}

export function LinkedInVerificationCard({
  enabled,
  result,
  status,
  unlinkAction,
}: {
  enabled: boolean;
  result?: string;
  status: LinkedInVerificationStatus | null;
  unlinkAction: () => Promise<void>;
}) {
  return (
    <section
      className="mt-6 rounded-[20px] border border-brand-border bg-white p-6 sm:p-8"
      aria-labelledby="linkedin-verification-title"
    >
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-[#0A66C2]/10 p-3 text-[#0A66C2]">
          <Linkedin className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-blue">
            Verifikasi tambahan
          </p>
          <h2
            id="linkedin-verification-title"
            className="mt-1 font-heading text-2xl font-semibold"
          >
            Hubungkan LinkedIn
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-brand-muted">
            Tambahkan tanda kepercayaan dari LinkedIn tanpa mengganti proses
            verifikasi mahasiswa StudyDate.
          </p>
        </div>
      </div>

      {result === "failed" ? (
        <p
          className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
          role="status"
        >
          LinkedIn belum berhasil dihubungkan. Coba lagi atau kembali nanti.
        </p>
      ) : null}

      {status ? (
        <>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            <Signal active>Akun LinkedIn terhubung</Signal>
            <Signal active={status.identityVerified}>
              Identitas di LinkedIn terverifikasi
            </Signal>
            <Signal active={status.workplaceVerified}>
              Tempat kerja di LinkedIn terverifikasi
            </Signal>
          </ul>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {enabled ? (
              <a
                href="/api/verification/linkedin/start"
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy"
              >
                Periksa ulang LinkedIn
              </a>
            ) : null}
            <form action={unlinkAction}>
              <button
                type="submit"
                className="focus-ring min-h-11 rounded-xl px-4 text-sm font-semibold text-brand-muted underline decoration-brand-border underline-offset-4"
              >
                Putuskan dari StudyDate
              </button>
            </form>
            <p className="text-sm leading-6 text-brand-muted">
              Status mahasiswa tetap diperiksa lewat PDDikti dan bukti
              kepemilikan akun kampus.
            </p>
          </div>
        </>
      ) : enabled ? (
        <div className="mt-6">
          <a
            href="/api/verification/linkedin/start"
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0A66C2] px-5 text-sm font-semibold text-white transition hover:bg-[#084f96]"
          >
            Hubungkan LinkedIn
          </a>
          <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-brand-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            StudyDate hanya menyimpan tanda verifikasi yang dikirim LinkedIn.
            Token akses tidak disimpan.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-brand-surface p-4">
          <p className="font-semibold text-brand-navy">
            Fitur ini sedang disiapkan
          </p>
          <p className="mt-1 text-sm leading-6 text-brand-muted">
            Tombol akan tersedia setelah akses resmi Verified on LinkedIn
            untuk StudyDate disetujui.
          </p>
        </div>
      )}
    </section>
  );
}
