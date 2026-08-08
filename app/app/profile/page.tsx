import { AppShell } from "@/components/app/app-shell";
import { AccountDangerZone } from "@/components/profile/account-danger-zone";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getEditableStudentProfile } from "@/lib/profile/service";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function ProfileContent() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getEditableStudentProfile(user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  return (
    <AppShell current="profile">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell max-w-6xl py-8 sm:py-10 lg:py-12">
          <p className="section-label">Akun</p>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-5xl">
            Edit profil
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
            Data diri, kontak Mutual Reveal, minat, dan tampilan di People.
            Foto wajah hanya lewat Identity Reveal.
          </p>
          <ProfileEditForm profile={profile} />
          <AccountDangerZone />
        </div>
      </main>
    </AppShell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan profil…
          </p>
        </main>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
