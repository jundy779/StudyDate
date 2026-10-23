import { requireSocialFeatureAccess } from "@/lib/account/student-access";
import { createCircleAction } from "@/app/app/circles/actions";
import { AppShell } from "@/components/app/app-shell";
import { CircleForm } from "@/components/circles/circle-form";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

type CreateCirclePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CreateCirclePage({
  searchParams,
}: CreateCirclePageProps) {
  await requireSocialFeatureAccess();
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  const params = await searchParams;
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;

  return (
    <AppShell current="circles">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell max-w-4xl py-8 sm:py-12 lg:py-16">
          <Link
            href="/app/circles"
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-brand-muted hover:text-brand-blue"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke Study Circle
          </Link>
          <header className="mt-7 max-w-2xl">
            <p className="app-kicker">Buat Study Circle</p>
            <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
              Mulai dari tujuan belajar yang jelas
            </h1>
            <p className="mt-5 text-lg leading-8 text-brand-muted">
              Circle langsung bisa diikuti mahasiswa yang memenuhi syarat. Kamu jadi
              pengelola Circle ini, bukan moderator StudyDate.
            </p>
          </header>

          {notice ? (
            <p
              role="alert"
              className="mt-7 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-brand-error"
            >
              {notice}
            </p>
          ) : null}

          <section
            aria-labelledby="circle-create-form-title"
            className="mt-8 rounded-[22px] border border-brand-border bg-white p-5 sm:p-8"
          >
            <h2
              id="circle-create-form-title"
              className="font-heading text-2xl font-semibold text-brand-navy"
            >
              Detail Circle
            </h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              Nama, deskripsi, dan pesan Circle harus berupa teks biasa tanpa
              kontak pribadi.
            </p>
            <div className="mt-7">
              <CircleForm
                action={createCircleAction}
                submitLabel="Buat Study Circle"
              />
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
