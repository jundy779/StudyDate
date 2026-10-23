import { getMyStudentAccess } from "@/lib/account/student-access";
import { VerificationForm } from "@/components/verification/verification-form";
import { LinkedInVerificationCard } from "@/components/verification/linkedin-verification-card";
import {
  cancelVerificationRequest,
  unlinkLinkedInVerification,
} from "./actions";
import { AppShell } from "@/components/app/app-shell";
import { AppPage, StatusChip, appButton } from "@/components/app/ui";
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
  const [verificationAllowed, capabilities, request, linkedInStatus, access] =
    await Promise.all([
      isVerificationRequestAllowed(user.id),
      getVerificationCapabilities(user.id),
      getLatestVerificationStatus(user.id),
      getLinkedInVerificationStatus(user.id),
      getMyStudentAccess(),
    ]);
  const isSchool = access?.tier === "school";
  const awaitingOwnership =
    request?.method === "academic_pending" &&
    request.pddikti_match_status === "matched";
  const active =
    request &&
    !awaitingOwnership &&
    !["cancelled", "expired", "rejected", "verified"].includes(request.status);

  return (
    <AppShell current="verification">
      <AppPage
        kicker="Pusat verifikasi mahasiswa"
        title="Verifikasi status mahasiswa"
        description={
          <>
            Kami mencocokkan data akademik dengan PDDikti dan memastikan akun ini benar-benar milikmu.{" "}
            {access?.verificationRequired
              ? "Verifikasi wajib sebelum kamu bisa memakai Cari Teman, Circle, Pesan, dan Acara."
              : "Verifikasi akan diwajibkan untuk semua mahasiswa sebelum memakai fitur utama."}
          </>
        }
        mascot={request?.status === "verified" ? "girang" : "mikir"}
      >
        {request ? (
          <section className="flex items-start gap-4 rounded-[22px] border-2 border-brand-navy bg-white p-4 shadow-[4px_4px_0_#0F1B33] sm:p-6" aria-label="Status verifikasi saat ini">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-brand-blue" aria-hidden="true" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-brand-muted">Status sekarang</span>
                <StatusChip tone={request.status === "verified" ? "go" : request.status === "needs_action" ? "warn" : request.status === "rejected" ? "stop" : "info"}>
                  {VERIFICATION_STATUS_LABELS[request.status]}
                </StatusChip>
              </div>
              <p className="mt-2 text-sm leading-6 text-brand-muted">
                Tanda verifikasi diberikan setelah data akademik cocok dan bukti
                kepemilikan akun disetujui.
              </p>
            </div>
          </section>
        ) : null}
        {isSchool ? (
          <section
            className="rounded-[20px] border border-brand-border bg-white p-6 sm:p-8"
            aria-labelledby="verification-school"
          >
            <ShieldCheck className="h-7 w-7 text-brand-blue" aria-hidden="true" />
            <h2 id="verification-school" className="mt-4 font-heading text-2xl font-semibold">
              Akun sekolah tidak bisa diverifikasi lewat PDDikti
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-brand-muted">
              PDDikti hanya berisi data perguruan tinggi. Dengan email sekolah, kamu tetap
              bisa mengikuti acara edukatif. Setelah kuliah, masuk dengan email kampus
              (.ac.id) atau Gmail untuk verifikasi dan membuka fitur lainnya.
            </p>
          </section>
        ) : !verificationAllowed ? (
          <section
            className="rounded-[20px] border border-brand-border bg-white p-6 sm:p-8"
            aria-labelledby="verification-unavailable"
          >
            <ShieldCheck className="h-7 w-7 text-brand-blue" aria-hidden="true" />
            <h2 id="verification-unavailable" className="mt-4 font-heading text-2xl font-semibold">
              Verifikasi mahasiswa belum tersedia
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-brand-muted">
              Verifikasi mahasiswa sedang disiapkan dan belum dibuka untuk semua
              pengguna. Kamu belum bisa mengirim data akademik atau bukti akun saat ini.
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
              <button className={appButton.quiet}>
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
      </AppPage>
    </AppShell>
  );
}

export default function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ linkedin?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-svh bg-brand-surface p-8"><p className="page-shell text-sm text-brand-muted">Menyiapkan pusat verifikasi...</p></main>}>
      <VerificationContent searchParams={searchParams} />
    </Suspense>
  );
}
