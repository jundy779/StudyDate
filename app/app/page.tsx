import { signOut } from "@/app/app/actions";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { CalendarDays, CheckCircle2, Network, Users } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";

const verificationLabels = {
  unverified: "Belum terverifikasi",
  pending: "Verifikasi sedang ditinjau",
  verified: "Terverifikasi",
  rejected: "Verifikasi perlu diulang",
} as const;

const productAreas = [
  {
    title: "People",
    description: "Temukan koneksi dengan konteks dan privasi yang jelas.",
    icon: Users,
  },
  {
    title: "Groups",
    description: "Mulai dari Study Circle dan kelompok kecil kampus.",
    icon: Network,
  },
  {
    title: "Campus Events",
    description: "Jelajahi kegiatan, workshop, dan kesempatan networking.",
    icon: CalendarDays,
  },
] as const;

async function PrivateAppHome() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  return (
    <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <header className="border-b border-brand-border bg-white">
        <div className="page-shell flex min-h-20 items-center justify-between gap-4">
          <Image
            src="/brand/logo-horizontal-color.png"
            alt="StudyDate ID"
            width={176}
            height={42}
            className="h-auto w-[150px] sm:w-[176px]"
            priority
          />
          <form action={signOut}>
            <button
              type="submit"
              className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy hover:border-brand-blue"
            >
              Keluar
            </button>
          </form>
        </div>
      </header>

      <div className="page-shell py-10 sm:py-14 lg:py-20">
        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <p className="section-label">Ruang privatmu</p>
            <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
              Halo, {profile.first_name} <span aria-hidden="true">👋</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-muted">
              Profil publikmu masih menggunakan{" "}
              <strong className="font-semibold text-brand-navy">
                {profile.public_alias}
              </strong>
              . Fitur discovery belum diaktifkan pada tahap ini.
            </p>
          </div>

          <aside className="rounded-[22px] border border-brand-border bg-white p-6 shadow-[0_18px_50px_rgba(15,27,51,0.07)]">
            <div className="flex items-start gap-3">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 h-6 w-6 shrink-0 text-brand-success"
              />
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  Onboarding selesai
                </h2>
                <p className="mt-1 text-sm leading-6 text-brand-muted">
                  Profilmu tersimpan secara privat dan belum dapat ditemukan
                  pengguna lain.
                </p>
              </div>
            </div>
            <dl className="mt-6 border-t border-brand-border pt-5">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-brand-muted">Status verifikasi</dt>
                <dd className="text-right text-sm font-semibold text-brand-navy">
                  {verificationLabels[profile.verification_status]}
                </dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="mt-12 sm:mt-16" aria-labelledby="product-areas">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-label">Berikutnya di StudyDate</p>
              <h2
                id="product-areas"
                className="mt-3 font-heading text-3xl font-semibold tracking-[-0.025em]"
              >
                Tiga ruang koneksi kampus
              </h2>
            </div>
            <span className="rounded-full bg-brand-navy px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
              Segera hadir
            </span>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {productAreas.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="rounded-[22px] border border-brand-border bg-white p-6 opacity-75"
              >
                <Icon
                  aria-hidden="true"
                  className="h-7 w-7 text-brand-blue"
                />
                <h3 className="mt-8 font-heading text-xl font-semibold">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-brand-muted">
                  {description}
                </p>
                <p className="mt-6 text-sm font-semibold text-brand-blue">
                  Segera hadir
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function AppHomePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface px-5 py-10">
          <p className="page-shell text-sm text-brand-muted">
            Menyiapkan ruang privatmu…
          </p>
        </main>
      }
    >
      <PrivateAppHome />
    </Suspense>
  );
}
