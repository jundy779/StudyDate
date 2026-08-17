import { AppShell } from "@/components/app/app-shell";
import {
  MEMBERSHIP_DISPLAY_NAME,
  MEMBERSHIP_LIMITS,
} from "@/lib/membership/limits";
import { getMyMembership } from "@/lib/membership/resolver";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function ComparisonTable() {
  const rows: { label: string; free: string; plus: string }[] = [
    {
      label: "People Discovery per hari",
      free: String(MEMBERSHIP_LIMITS.free.peopleDiscoveryDaily),
      plus: String(MEMBERSHIP_LIMITS.plus.peopleDiscoveryDaily),
    },
    {
      label: "Perkenalan baru per hari",
      free: String(MEMBERSHIP_LIMITS.free.introductionRequestsDaily),
      plus: String(MEMBERSHIP_LIMITS.plus.introductionRequestsDaily),
    },
    {
      label: "Perkenalan menunggu jawaban",
      free: String(MEMBERSHIP_LIMITS.free.activeIntroductions),
      plus: String(MEMBERSHIP_LIMITS.plus.activeIntroductions),
    },
    {
      label: "Circle yang kamu kelola",
      free: String(MEMBERSHIP_LIMITS.free.createdCirclesActive),
      plus: String(MEMBERSHIP_LIMITS.plus.createdCirclesActive),
    },
    {
      label: "Circle yang kamu ikuti",
      free: String(MEMBERSHIP_LIMITS.free.joinedCirclesActive),
      plus: String(MEMBERSHIP_LIMITS.plus.joinedCirclesActive),
    },
    {
      label: "Filter People lanjutan",
      free: "Kampus dan program studi",
      plus: "Termasuk semester, kota, tujuan, dan minat",
    },
  ];

  return (
    <div className="mt-8 overflow-x-auto rounded-[22px] border border-brand-border bg-white">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="sr-only">Perbandingan StudyDate Free dan Plus</caption>
        <thead>
          <tr className="border-b border-brand-border">
            <th scope="col" className="px-5 py-4 font-semibold text-brand-navy">
              Kapasitas
            </th>
            <th scope="col" className="px-5 py-4 font-semibold text-brand-navy">
              Free
            </th>
            <th scope="col" className="px-5 py-4 font-semibold text-brand-navy">
              Plus
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-brand-border last:border-b-0">
              <th scope="row" className="px-5 py-4 font-medium text-brand-navy">
                {row.label}
              </th>
              <td className="px-5 py-4 text-brand-muted">{row.free}</td>
              <td className="px-5 py-4 text-brand-muted">{row.plus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function MembershipContent() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const membership = await getMyMembership();
  const isPlus = membership.plan === "plus";
  const endsLabel =
    isPlus && membership.endsAt
      ? dateFmt.format(new Date(membership.endsAt))
      : null;

  return (
    <AppShell current="membership">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell py-8 sm:py-12 lg:py-16">
          <p className="section-label">Akun</p>
          <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
            Lebih banyak ruang untuk belajar, berkenalan, dan membangun koneksi.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-muted">
            StudyDate Free tetap utuh. StudyDate Plus menambah kapasitas, bukan
            memotong privasi, persetujuan, atau perlindungan keamanan.
          </p>

          <section className="mt-10 rounded-[22px] border border-brand-border bg-white p-6 sm:p-8">
            <p className="text-sm font-semibold text-brand-muted">Paket kamu</p>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy">
              {MEMBERSHIP_DISPLAY_NAME[membership.plan]}
            </h2>
            {isPlus ? (
              <p className="mt-3 leading-7 text-brand-muted">
                Aktif
                {endsLabel ? ` sampai ${endsLabel}` : " tanpa batas waktu pada grant ini"}.
              </p>
            ) : membership.plusExpired ? (
              <p className="mt-3 leading-7 text-brand-muted">
                Paket Plus kamu telah berakhir. Saat ini akun kembali memakai
                StudyDate Free. Data yang sudah ada tetap aman.
              </p>
            ) : (
              <p className="mt-3 leading-7 text-brand-muted">
                Kamu memakai kapasitas Free. Circle, perkenalan, dan percakapan
                yang sudah ada tetap aman jika paket berubah.
              </p>
            )}
            <p className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-brand-border px-5 text-sm font-semibold text-brand-muted">
              StudyDate Plus segera tersedia
            </p>
            <p className="mt-3 text-sm leading-6 text-brand-muted">
              Pembayaran belum dibuka. Tidak ada checkout pada halaman ini.
            </p>
          </section>

          <ComparisonTable />

          <p className="mt-8 max-w-2xl text-sm leading-6 text-brand-muted">
            Blokir, laporkan, pusat keamanan, privasi, persetujuan, Identity
            Reveal, Contact Reveal, dan penghapusan akun tetap tersedia untuk
            semua paket.{" "}
            <Link
              href="/app/settings"
              className="focus-ring font-semibold text-brand-blue underline-offset-2 hover:underline"
            >
              Buka pengaturan
            </Link>
            .
          </p>
        </div>
      </main>
    </AppShell>
  );
}

export default function MembershipPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan paket…</p>
        </main>
      }
    >
      <MembershipContent />
    </Suspense>
  );
}
