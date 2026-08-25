import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { claimEarlyAccessForCurrentUser } from "@/lib/early-access/claim";
import { createClient } from "@/lib/supabase/server";
import { buildOnboardingPrefillFromClaim } from "@/lib/early-access/claim-state";
import { loadApprovedCampusOptions } from "@/lib/campus/service";
import { loadApprovedStudyProgramOptions } from "@/lib/study-program/service";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function OnboardingContent() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getPrivateProfile(user.id);
  if (profile?.onboarding_completed_at) {
    redirect("/app");
  }

  // Idempotent claim for users who land on onboarding without a fresh callback
  // (e.g. bookmarked /onboarding). Prefill never includes source or waitlist id.
  const claim = await claimEarlyAccessForCurrentUser();
  if (!claim.earlyAccessClaimed) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?error=early_access_required");
  }
  const earlyAccessPrefill = buildOnboardingPrefillFromClaim(claim);

  const [campusOptions, studyProgramOptions] = await Promise.all([
    loadApprovedCampusOptions(),
    loadApprovedStudyProgramOptions(),
  ]);

  return (
    <main className="min-h-svh overflow-x-clip bg-brand-surface px-5 py-7 sm:px-8 sm:py-10 lg:py-14">
      <div className="mx-auto w-full max-w-[820px]">
        <Link
          href="/"
          aria-label="Kembali ke halaman utama StudyDate"
          className="focus-ring inline-flex rounded-lg"
        >
          <Image
            src="/brand/logo-horizontal-color.png"
            alt="StudyDate ID"
            width={180}
            height={42}
            className="h-auto w-[160px] sm:w-[180px]"
            priority
          />
        </Link>
        <section className="mt-7 rounded-[24px] border border-brand-border bg-white p-5 shadow-[0_24px_70px_rgba(15,27,51,0.08)] sm:mt-9 sm:p-9 lg:p-12">
          <OnboardingForm
            campusOptions={campusOptions}
            studyProgramOptions={studyProgramOptions}
            earlyAccessPrefill={earlyAccessPrefill}
            showClaimConflict={claim.showConflictSupport}
          />
        </section>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface px-5 py-10">
          <p className="mx-auto max-w-[820px] text-sm text-brand-muted">
            Menyiapkan onboarding…
          </p>
        </main>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
