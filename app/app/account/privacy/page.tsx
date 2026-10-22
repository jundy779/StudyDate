import { AppShell } from "@/components/app/app-shell";
import { AppPage } from "@/components/app/ui";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { BookOpen, LifeBuoy, Scale, Shield } from "lucide-react";
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
      <AppPage
        kicker="Akun"
        title="Privasi & keamanan"
        description="Dokumen publik StudyDate untuk memahami privasi, keamanan, dan aturan komunitas."
        mascot="kedip"
      >
          <ul className="grid max-w-3xl gap-3">
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
      </AppPage>
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
