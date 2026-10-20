import { requireSocialFeatureAccess } from "@/lib/account/student-access";
import { AppShell } from "@/components/app/app-shell";
import { MascotEmptyState } from "@/components/brand/mascot-empty-state";
import { IntroductionCard } from "@/components/introductions/introduction-card";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  countPendingReceivedIntroductions,
  listReceivedIntroductions,
  listSentIntroductions,
} from "@/lib/introductions/service";
import Link from "next/link";
import { redirect } from "next/navigation";

type IntroductionsPageProps = {
  searchParams: Promise<{ tab?: string; state?: string }>;
};

const stateMessages: Record<string, string> = {
  sent: "Perkenalan terkirim. Menunggu jawaban.",
  accepted:
    "Perkenalan diterima. Lanjutkan di Pesan untuk memulai percakapan anonim.",
  declined: "Perkenalan ditolak.",
  cancelled: "Perkenalan dibatalkan.",
  blocked: "Pengguna diblokir. Interaksi baru tidak tersedia.",
  reported: "Laporan diterima. Terima kasih sudah membantu menjaga ruang aman.",
  error: "Perkenalan belum dapat diproses. Coba lagi sebentar.",
  invalid: "Periksa kembali isianmu, lalu coba lagi.",
};

export default async function IntroductionsPage({
  searchParams,
}: IntroductionsPageProps) {
  await requireSocialFeatureAccess();
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const params = await searchParams;
  const tab = params.tab === "terkirim" ? "terkirim" : "masuk";
  const [received, sent, pendingCount] = await Promise.all([
    listReceivedIntroductions(),
    listSentIntroductions(),
    countPendingReceivedIntroductions(),
  ]);

  const stateMessage = params.state ? stateMessages[params.state] : null;
  const items = tab === "terkirim" ? sent : received;
  const panelId = tab === "masuk" ? "intro-panel-masuk" : "intro-panel-terkirim";

  return (
    <AppShell current="introductions" pendingIntroductions={pendingCount}>
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell py-8 sm:py-12 lg:py-16">
          <p className="section-label">Koneksi perlahan</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-5xl">
            Perkenalan
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-brand-muted">
            Kirim dan kelola perkenalan privat. Identitas lengkap dan kontak
            tetap tertutup sampai tahap berikutnya.
          </p>

          {stateMessage ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-6 rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6 text-brand-navy"
            >
              {stateMessage}
            </p>
          ) : null}

          <div
            role="tablist"
            aria-label="Daftar perkenalan"
            className="mt-8 flex flex-wrap gap-2"
          >
            <Link
              href="/app/introductions?tab=masuk"
              role="tab"
              id="intro-tab-masuk"
              aria-controls="intro-panel-masuk"
              aria-selected={tab === "masuk"}
              tabIndex={tab === "masuk" ? 0 : -1}
              className={`focus-ring inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold ${
                tab === "masuk"
                  ? "bg-brand-navy text-white"
                  : "border border-brand-border bg-white text-brand-navy"
              }`}
            >
              Masuk
              {pendingCount > 0 ? (
                <span className="ml-2 rounded-full bg-brand-blue px-2 py-0.5 text-xs text-white">
                  {pendingCount}
                </span>
              ) : null}
            </Link>
            <Link
              href="/app/introductions?tab=terkirim"
              role="tab"
              id="intro-tab-terkirim"
              aria-controls="intro-panel-terkirim"
              aria-selected={tab === "terkirim"}
              tabIndex={tab === "terkirim" ? 0 : -1}
              className={`focus-ring inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold ${
                tab === "terkirim"
                  ? "bg-brand-navy text-white"
                  : "border border-brand-border bg-white text-brand-navy"
              }`}
            >
              Terkirim
            </Link>
          </div>

          <section
            id={panelId}
            role="tabpanel"
            aria-labelledby={tab === "masuk" ? "intro-tab-masuk" : "intro-tab-terkirim"}
            className="mt-8 space-y-4"
          >
            {items.length === 0 ? (
              tab === "masuk" ? (
                <MascotEmptyState
                  pose="hello"
                  title="Belum ada perkenalan masuk"
                  description="Saat seseorang ingin mengenalmu lebih jauh, perkenalannya akan muncul di sini."
                />
              ) : (
                <MascotEmptyState
                  pose="hello"
                  title="Kamu belum mengirim perkenalan"
                  description="Buka Cari Teman, lihat profil tanpa nama asli, lalu kirim pesan pembuka yang hangat."
                  action={{ href: "/app/people", label: "Buka Cari Teman" }}
                />
              )
            ) : (
              items.map((item) => (
                <IntroductionCard
                  key={item.request_id}
                  item={item}
                  direction={tab === "masuk" ? "received" : "sent"}
                />
              ))
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}
