import { signOut } from "@/app/app/actions";
import { updateNotificationPreference } from "@/app/app/settings/notification-actions";
import { AppShell } from "@/components/app/app-shell";
import { AppPage, Panel, StatusChip, appButton } from "@/components/app/ui";
import { AccountDangerZone } from "@/components/profile/account-danger-zone";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { BlockedStudentsList } from "@/components/settings/blocked-students-list";
import { TelegramCompanionSetting } from "@/components/settings/telegram-companion-setting";
import { listMyBlockedStudents } from "@/lib/account/blocks";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { loadApprovedCampusOptions } from "@/lib/campus/service";
import { getEditableStudentProfile } from "@/lib/profile/service";
import { loadApprovedStudyProgramOptions } from "@/lib/study-program/service";
import { getMyTelegramCompanionState } from "@/lib/telegram/service";
import { listNotificationPreferences } from "@/lib/notifications/preferences";
import { NOTIFICATION_PREFERENCE_LABELS } from "@/lib/notifications/constants";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

function maskEmail(email: string | undefined) {
  if (!email) return "Akun terautentikasi";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Akun terautentikasi";
  return `${local.slice(0, 2)}${"•".repeat(Math.min(Math.max(local.length - 2, 2), 6))}@${domain}`;
}

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Panel id={id} title={title} description={description} quiet>
      {children}
    </Panel>
  );
}

async function SettingsContent() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const [
    profile,
    blockedStudents,
    campusOptions,
    studyProgramOptions,
    telegramCompanion,
    notificationPreferences,
  ] =
    await Promise.all([
      getEditableStudentProfile(user.id),
      listMyBlockedStudents(),
      loadApprovedCampusOptions(),
      loadApprovedStudyProgramOptions(),
      getMyTelegramCompanionState(),
      listNotificationPreferences(),
    ]);
  if (!profile) redirect("/onboarding");

  return (
    <AppShell current="settings">
      <AppPage
        kicker="Akun mahasiswa"
        title="Pengaturan"
        description="Atur profil belajar, siapa yang bisa menemukanmu, akun yang kamu blokir, dan notifikasi."
        mascot="kedip"
      >
          <nav
            aria-label="Bagian pengaturan"
            className="sticky top-16 z-20 -mx-1 flex gap-2 overflow-x-auto bg-brand-surface/95 px-1 py-2 backdrop-blur md:top-0"
          >
            {[
              ["#profil", "Profil"],
              ["#privasi", "Privasi"],
              ["#blokir", "Blokir"],
              ["#notifikasi", "Notifikasi"],
              ["#akun", "Akun"],
              ["/app/membership", "StudyDate Plus"],
            ].map(([href, label]) => (
              <a
                key={href}
                className="focus-ring inline-flex min-h-10 shrink-0 items-center rounded-full border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy hover:border-brand-navy"
                href={href}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="grid gap-6">
            <SettingsSection
              id="profil"
              title="Profil"
              description="Kelola informasi yang membantu kamu ditemukan oleh teman belajar."
            >
              <div className="rounded-xl bg-brand-surface px-4 py-3 text-sm leading-6 text-brand-muted sm:px-5">
                <strong className="text-brand-navy">{profile.publicAlias}</strong>{" "}
                tidak dapat diubah. Alias anonim dibuat untuk menjaga
                konsistensi koneksi kamu.
              </div>
              <ProfileEditForm
                profile={profile}
                campusOptions={campusOptions}
                studyProgramOptions={studyProgramOptions}
              />
            </SettingsSection>

            <SettingsSection
              id="privasi"
              title="Privasi"
              description="Pahami bagaimana profil kamu muncul dan data mana yang tetap privat."
            >
              <div className="space-y-6 border-l-2 border-brand-border pl-5 sm:pl-6">
                <div>
                  <h3 className="font-heading text-lg font-semibold text-brand-navy">
                    Terlihat saat berkenalan
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">
                    Nama samaran, avatar, kampus, program studi, semester,
                    wilayah umum, perkenalan singkat, minat, tujuan, dan tanda
                    verifikasi hanya jika sudah disetujui.
                  </p>
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-brand-navy">
                    Tetap pribadi
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">
                    Nama lengkap, email, NIM, identitas resmi, lokasi pasti,
                    foto wajah, dan kontak tidak tampil di pencarian.
                  </p>
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-brand-navy">
                    Dibuka jika sama-sama setuju
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">
                    Nama depan dan foto hanya dibuka untuk percakapan yang kamu
                    pilih. Telegram, Instagram, atau LinkedIn juga dibagikan satu
                    per satu setelah kedua pihak setuju. Tetap berhati-hati saat
                    mengenal orang baru.
                  </p>
                </div>
              </div>
              <p className="mt-6 text-sm leading-6 text-brand-muted">
                Informasi yang ditampilkan tetap mengikuti pilihan privasimu.
                Untuk penjelasan lengkap, baca{" "}
                <Link
                  href="/privacy"
                  className="focus-ring font-semibold text-brand-blue underline-offset-2 hover:underline"
                >
                  Kebijakan Privasi
                </Link>
                .
              </p>
            </SettingsSection>

            <SettingsSection
              id="blokir"
              title="Akun yang diblokir"
              description="Kelola akun yang tidak ingin kamu ajak berinteraksi. Hanya blokir yang kamu buat yang terlihat di sini."
            >
              <BlockedStudentsList students={blockedStudents} />
            </SettingsSection>

            <SettingsSection
              id="notifikasi"
              title="Notifikasi"
              description="Pilih pemberitahuan yang ingin kamu terima di StudyDate. Email, notifikasi perangkat, SMS, dan Telegram dapat diatur saat fiturnya tersedia."
            >
              <div className="divide-y divide-brand-border rounded-xl border border-brand-border bg-white">
                {notificationPreferences.map((preference) => (
                  <form
                    key={preference.type}
                    action={updateNotificationPreference}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <input type="hidden" name="type" value={preference.type} />
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="break-words text-sm font-semibold text-brand-navy">
                        {NOTIFICATION_PREFERENCE_LABELS[preference.type]}
                      </span>
                      <StatusChip tone={preference.inAppEnabled ? "go" : "muted"}>
                        {preference.inAppEnabled ? "Aktif" : "Mati"}
                      </StatusChip>
                    </span>
                    <button
                      name="enabled"
                      value={preference.inAppEnabled ? "false" : "true"}
                      className={appButton.quiet}
                    >
                      {preference.inAppEnabled ? "Matikan" : "Nyalakan"}
                    </button>
                  </form>
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              id="paket"
              title="StudyDate Plus"
              description="Paket menentukan batas pencarian teman, perkenalan, dan circle. Fitur keamanan dan privasi tetap sama untuk semua pengguna."
            >
              <Link
                href="/app/membership"
                className={appButton.secondary}
              >
                Lihat paket
              </Link>
            </SettingsSection>

            <SettingsSection
              id="akun"
              title="Akun"
              description="Kelola sesi dan status akun."
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-border pb-6">
                <div>
                  <p className="text-sm font-semibold text-brand-navy">
                    Akun masuk
                  </p>
                  <p className="mt-1 text-sm text-brand-muted">
                    {maskEmail(user.email)}
                  </p>
                </div>
                <form action={signOut}>
                  <button
                    type="submit"
                    className={appButton.quiet}
                  >
                    Keluar
                  </button>
                </form>
              </div>
              <p className="mt-4 text-sm leading-6 text-brand-muted">
                Tombol ini mengeluarkanmu dari perangkat ini saja. Pilihan keluar dari semua
                perangkat sekaligus belum tersedia, jadi kalau kamu masuk di perangkat lain,
                buka StudyDate di perangkat itu lalu tekan Keluar.
              </p>
              <TelegramCompanionSetting initialState={telegramCompanion} />
              <AccountDangerZone />
            </SettingsSection>
          </div>
      </AppPage>
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan pengaturan...
          </p>
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
