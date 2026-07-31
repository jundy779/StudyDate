import { VerificationForm } from "@/components/verification/verification-form";
import { AppHeader } from "@/components/app/app-header";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  VERIFICATION_STATUS_LABELS,
} from "@/lib/verification/constants";
import { getLatestVerificationStatus } from "@/lib/verification/status";
import { isVerificationRequestAllowed } from "@/lib/verification/readiness";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function VerificationContent() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  const verificationAllowed = await isVerificationRequestAllowed(user.id);
  const request = await getLatestVerificationStatus(user.id);
  const active = request && !["cancelled", "expired", "rejected"].includes(request.status);

  return (
    <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <AppHeader current="verification" />
      <div className="page-shell py-8 sm:py-12 lg:py-16">
        <div className="max-w-3xl">
          <p className="section-label">Student Verification Center</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Verifikasi status mahasiswa
          </h1>
          <p className="mt-5 text-lg leading-8 text-brand-muted">
            Verifikasi menggabungkan pencocokan data akademik dan bukti
            kepemilikan akun. Proses ini opsional.
          </p>
        </div>
        {request ? (
          <section className="my-8 flex items-start gap-4 rounded-[20px] border border-brand-border bg-white p-5 sm:my-10 sm:p-6" aria-label="Status verifikasi saat ini">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-brand-blue" aria-hidden="true" />
            <div>
              <p className="font-semibold">
                {VERIFICATION_STATUS_LABELS[request.status]}
              </p>
              <p className="mt-1 text-sm leading-6 text-brand-muted">
                Badge hanya diberikan setelah data akademik cocok dan bukti
                kepemilikan disetujui.
              </p>
            </div>
          </section>
        ) : <div className="h-8 sm:h-10" />}
        {!verificationAllowed ? (
          <section
            className="rounded-[20px] border border-brand-border bg-white p-6 sm:p-8"
            aria-labelledby="verification-unavailable"
          >
            <ShieldCheck className="h-7 w-7 text-brand-blue" aria-hidden="true" />
            <h2 id="verification-unavailable" className="mt-4 font-heading text-2xl font-semibold">
              Verifikasi mahasiswa belum tersedia
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-brand-muted">
              Student Verification Center sedang dipersiapkan untuk pengujian
              terkontrol. Data akademik dan bukti kepemilikan belum dapat
              dikirim saat ini.
            </p>
          </section>
        ) : active ? (
          <p className="rounded-[20px] border border-brand-border bg-white p-6 leading-7 text-brand-muted">
            Permintaan aktif sedang diproses. Jika diperlukan tindakan
            tambahan, status akan diperbarui tanpa membuka data sensitifmu.
          </p>
        ) : (
          <VerificationForm />
        )}
      </div>
    </main>
  );
}

export default function VerificationPage() {
  return (
    <Suspense fallback={<main className="min-h-svh bg-brand-surface p-8"><p className="page-shell text-sm text-brand-muted">Menyiapkan Verification Center…</p></main>}>
      <VerificationContent />
    </Suspense>
  );
}
