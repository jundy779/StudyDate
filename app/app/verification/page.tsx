import { VerificationForm } from "@/components/verification/verification-form";
import { LinkedInVerificationCard } from "@/components/verification/linkedin-verification-card";
import {
  cancelVerificationRequest,
  unlinkLinkedInVerification,
} from "./actions";
import { AppShell } from "@/components/app/app-shell";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  VERIFICATION_STATUS_LABELS,
} from "@/lib/verification/constants";
import { getLatestVerificationStatus } from "@/lib/verification/status";
import {
  getLinkedInVerificationStatus,
  isLinkedInVerificationConfigured,
} from "@/lib/verification/linkedin";
import {
  getVerificationCapabilities,
  isVerificationRequestAllowed,
} from "@/lib/verification/readiness";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function VerificationContent({
  searchParams,
}: {
  searchParams: Promise<{ linkedin?: string | string[] }>;
}) {
  const params = await searchParams;
  const linkedInResult =
    typeof params.linkedin === "string" ? params.linkedin : undefined;
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  const [verificationAllowed, capabilities, request, linkedInStatus] =
    await Promise.all([
      isVerificationRequestAllowed(user.id),
      getVerificationCapabilities(user.id),
      getLatestVerificationStatus(user.id),
      getLinkedInVerificationStatus(user.id),
    ]);
  const awaitingOwnership =
    request?.method === "academic_pending" &&
    request.pddikti_match_status === "matched";
  const active =
    request &&
    !awaitingOwnership &&
    !["cancelled", "expired", "rejected", "verified"].includes(request.status);

  return (
    <AppShell current="verification">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <div className="page-shell py-8 sm:py-12 lg:py-16">
        <div className="max-w-3xl">
          <p className="section-label">Pusat verifikasi mahasiswa</p>
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
                Tanda verifikasi hanya diberikan setelah data akademik cocok dan bukti
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
              Pusat verifikasi mahasiswa sedang dipersiapkan untuk pengujian
              terkontrol. Data akademik dan bukti kepemilikan belum dapat
              dikirim saat ini.
            </p>
          </section>
        ) : active ? (
          <section className="rounded-[20px] border border-brand-border bg-white p-6">
            <p className="leading-7 text-brand-muted">
              {request.status === "needs_action"
                ? "Petugas pemeriksa meminta perbaikan bukti. Batalkan permintaan ini untuk mengirim pengajuan baru."
                : "Permintaan aktif sedang diproses. Status akan diperbarui tanpa membuka data sensitifmu."}
            </p>
            <form action={cancelVerificationRequest} className="mt-5">
              <input type="hidden" name="requestId" value={request.id} />
              <button className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy">
                Batalkan permintaan
              </button>
            </form>
          </section>
        ) : request?.status === "verified" ? null : (
          <VerificationForm
            capabilities={capabilities}
            matchedRequestId={awaitingOwnership ? request.id : undefined}
          />
        )}
        <LinkedInVerificationCard
          enabled={isLinkedInVerificationConfigured()}
          result={linkedInResult}
          status={linkedInStatus}
          unlinkAction={unlinkLinkedInVerification}
        />
      </div>
      </main>
    </AppShell>
  );
}

export default function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ linkedin?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-svh bg-brand-surface p-8"><p className="page-shell text-sm text-brand-muted">Menyiapkan pusat verifikasi…</p></main>}>
      <VerificationContent searchParams={searchParams} />
    </Suspense>
  );
}
