import { StaffShell } from "@/components/staff/staff-shell";
import { requireActiveStaff } from "@/lib/staff/authorization";
import { BookOpen, GraduationCap, ScrollText, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function AdminContent() {
  const access = await requireActiveStaff();
  if (access.role === "owner") redirect("/owner");

  const tools = [
    access.canUsersRead || access.canUsersSupport
      ? {
          href: "/staff/users",
          title: "Akun mahasiswa",
          description: "Bantu kendala akun, onboarding, dan status membership.",
          icon: Users,
        }
      : null,
    access.canEarlyAccessRead
      ? {
          href: "/staff/early-access",
          title: "Akses Awal",
          description: "Periksa daftar pendaftar dan status aktivasi.",
          icon: ScrollText,
        }
      : null,
    access.verificationReviewer
      ? {
          href: "/admin/verifications",
          title: "Verifikasi mahasiswa",
          description: "Tinjau pengajuan verifikasi yang masuk.",
          icon: ShieldCheck,
        }
      : null,
    {
      href: "/admin/campuses",
      title: "Kampus",
      description: "Kurasi kampus yang tersedia saat onboarding.",
      icon: GraduationCap,
    },
    {
      href: "/admin/study-programs",
      title: "Program studi",
      description: "Kurasi program studi yang tersedia saat onboarding.",
      icon: BookOpen,
    },
  ].filter((tool) => tool !== null);

  return (
    <StaffShell role={access.role} current="overview" access={access}>
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Ruang operasional Admin</p>
          <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Pilih pekerjaan yang perlu ditangani
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-muted">
            Menu hanya menampilkan akses yang diberikan Owner. Data sensitif
            mahasiswa tetap dibatasi berdasarkan tugas.
          </p>
          <div className="mt-10 divide-y divide-brand-border border-y border-brand-border">
            {tools.map(({ href, title, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="focus-ring grid gap-4 py-6 sm:grid-cols-[auto_1fr_auto] sm:items-center"
              >
                <Icon className="h-6 w-6 text-brand-blue" aria-hidden="true" />
                <span>
                  <span className="block font-heading text-xl font-semibold">{title}</span>
                  <span className="mt-1 block text-sm leading-6 text-brand-muted">{description}</span>
                </span>
                <span className="text-sm font-semibold text-brand-blue">Buka →</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </StaffShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan ruang operasional…</p>
        </main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
