import { AppShell } from "@/components/app/app-shell";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { BookOpen, LifeBuoy, Scale, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

const resources = [
  {
    href: "/help",
    title: "Bantuan",
    description: "FAQ dan panduan memakai StudyDate.",
    icon: LifeBuoy,
  },
  {
    href: "/privacy",
    title: "Kebijakan Privasi",
    description: "Bagaimana data diproses dan dilindungi.",
    icon: Scale,
  },
  {
    href: "/safety",
    title: "Pusat Keamanan",
    description: "Praktik aman berkenalan dan berinteraksi.",
    icon: Shield,
  },
  {
    href: "/community-guidelines",
    title: "Pedoman Komunitas",
    description: "Aturan perilaku di ruang mahasiswa StudyDate.",
    icon: BookOpen,
  },
] as const;

async function PrivacySafetyContent() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  return (
    <AppShell current="privacy-safety">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell max-w-3xl py-8 sm:py-12">
          <p className="section-label">Akun</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0 max-w-xl">
              <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
                Privasi & keamanan
              </h1>
              <p className="mt-3 text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
                Dokumen publik StudyDate untuk memahami privasi, keamanan, dan
                aturan komunitas.
              </p>
            </div>
            <Image
              src="/brand/mascot/avatar.png"
              alt=""
              width={96}
              height={96}
              className="h-20 w-20 rounded-2xl object-cover object-top shadow-[0_8px_18px_rgba(15,27,51,0.12)] sm:h-24 sm:w-24"
            />
          </div>
          <ul className="mt-8 space-y-3">
            {resources.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="focus-ring flex gap-4 rounded-[20px] border border-brand-border bg-white p-4 transition-colors hover:border-brand-blue sm:p-5"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-surface text-brand-blue">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-heading text-lg font-semibold text-brand-navy">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-brand-muted">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </AppShell>
  );
}

export default function PrivacySafetyPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Memuat…</p>
        </main>
      }
    >
      <PrivacySafetyContent />
    </Suspense>
  );
}
