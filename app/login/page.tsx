import { AuthShell } from "@/components/auth/auth-shell";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { hasEnvVars } from "@/lib/utils";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Masuk | StudyDate ID",
  robots: { index: false, follow: false, nocache: true },
};

async function LoginContent() {
  if (hasEnvVars) {
    const user = await getAuthenticatedUser();
    if (user) {
      const profile = await getPrivateProfile(user.id);
      redirect(profile?.onboarding_completed_at ? "/app" : "/onboarding");
    }
  }

  return (
    <AuthShell>
      <MagicLinkForm />
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <p className="text-sm text-brand-muted">Menyiapkan halaman masuk…</p>
        </AuthShell>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
