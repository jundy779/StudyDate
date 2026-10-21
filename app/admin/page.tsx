import { StaffShell } from "@/components/staff/staff-shell";
import { EmptyState, Panel, StaffPage, TodoItem } from "@/components/staff/ui";
import { requireActiveStaff } from "@/lib/staff/authorization";
import { getEarlyAccessQueueSummary, listVerificationQueue } from "@/lib/staff/service";
import { BookOpen, CalendarDays, GraduationCap, Inbox, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

const OPEN_VERIFICATION = ["pending", "under_review", "needs_action"];

async function AdminContent() {
  const access = await requireActiveStaff();
  if (access.role === "owner") redirect("/owner");

  const canEarlyAccess = access.canEarlyAccessRead || access.canEarlyAccessReview;
  const canUsers = access.canUsersRead || access.canUsersSupport;
  const canVerification = access.verificationReviewer;

  const [earlyAccess, verificationRows] = await Promise.all([
    canEarlyAccess ? getEarlyAccessQueueSummary().catch(() => null) : Promise.resolve(null),
    canVerification ? listVerificationQueue().catch(() => null) : Promise.resolve(null),
  ]);
  const openVerifications = verificationRows
    ? verificationRows.filter((row) => OPEN_VERIFICATION.includes(row.status)).length
    : null;
  const totalTodo = (earlyAccess?.waiting_count ?? 0) + (openVerifications ?? 0);
  const hasQueue = canEarlyAccess || canVerification;

  const others = [
    canUsers
      ? { href: "/staff/users", icon: Users, title: "Akun mahasiswa", text: "Bantu masalah login, profil, dan paket." }
      : null,
    { href: "/admin/events", icon: CalendarDays, title: "Acara Kampus", text: "Pantau acara yang dibuat mahasiswa." },
    { href: "/admin/campuses", icon: GraduationCap, title: "Daftar kampus", text: "Pilihan kampus saat mahasiswa mendaftar." },
    { href: "/admin/study-programs", icon: BookOpen, title: "Daftar jurusan", text: "Pilihan jurusan saat mahasiswa mendaftar." },
  ].filter((item) => item !== null);

  return (
    <StaffShell role={access.role} current="overview" access={access}>
      <StaffPage
        kicker="Halo, Admin"
        title={totalTodo > 0 ? "Ini yang perlu ditangani" : "Semua beres untuk sekarang"}
        description="Menu yang tampil sesuai tugas dari Owner. Data pribadi mahasiswa hanya terlihat sebatas yang kamu perlukan."
        mascot={totalTodo > 0 ? "mikir" : "girang"}
      >
        <Panel title="Daftar tugas" description="Angka diambil langsung dari sistem.">
          {hasQueue ? (
            <ul className="grid gap-3 lg:grid-cols-2">
              {canEarlyAccess ? (
                <TodoItem
                  href="/staff/early-access?status=waiting&sort=oldest"
                  icon={Inbox}
                  title="Pendaftar Akses Awal menunggu"
                  description={
                    earlyAccess && earlyAccess.stale_waiting_count > 0
                      ? `${earlyAccess.stale_waiting_count} di antaranya sudah lebih dari 7 hari.`
                      : "Periksa data pendaftar lalu tentukan tindak lanjutnya."
                  }
                  count={earlyAccess?.waiting_count ?? null}
                  urgent={(earlyAccess?.stale_waiting_count ?? 0) > 0}
                />
              ) : null}
              {canVerification ? (
                <TodoItem
                  href="/admin/verifications"
                  icon={ShieldCheck}
                  title="Verifikasi mahasiswa menunggu"
                  description="Cocokkan data kampus dan bukti kepemilikan akun."
                  count={openVerifications}
                />
              ) : null}
            </ul>
          ) : (
            <EmptyState title="Belum ada antrean yang ditugaskan ke kamu" expression="kedip">
              Kalau kamu perlu memeriksa pendaftar atau verifikasi, minta Owner menambahkan tugasnya.
            </EmptyState>
          )}
        </Panel>

        <Panel title="Menu lain" quiet>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="focus-ring group flex h-full items-start gap-3 rounded-2xl border border-brand-border bg-white p-4 transition-colors hover:border-brand-navy"
                >
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
                  <span>
                    <span className="block font-semibold text-brand-navy group-hover:text-brand-blue">{item.title}</span>
                    <span className="mt-0.5 block text-sm leading-5 text-brand-muted">{item.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </StaffPage>
    </StaffShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan halaman Admin...</p>
        </main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
