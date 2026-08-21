import { signOut } from "@/app/app/actions";
import { updateNotificationPreference } from "@/app/app/settings/notification-actions";
import { AppShell } from "@/components/app/app-shell";
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
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 border-t border-brand-border py-8 first:border-t-0 first:pt-0 sm:py-10">
      <div className="max-w-3xl">
        <h2
          id={`${id}-title`}
          className="font-heading text-2xl font-semibold tracking-[-0.025em] text-brand-navy"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-brand-muted sm:text-base sm:leading-7">
          {description}
        </p>
      </div>
      <div className="mt-6">{children}</div>
    </section>
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
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell max-w-6xl py-8 sm:py-10 lg:py-12">
          <p className="section-label">Akun mahasiswa</p>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl lg:text-5xl">
            Pengaturan
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
            Kelola profil belajar, visibilitas, blokir, dan status akun tanpa
            mengubah alur koneksi privat StudyDate.
          </p>

          <nav
            aria-label="Bagian pengaturan"
            className="mt-7 flex gap-x-5 gap-y-2 overflow-x-auto border-b border-brand-border pb-3 text-sm font-semibold"
          >
            <a className="focus-ring shrink-0 text-brand-blue" href="#profil">
              Profil
            </a>
            <a className="focus-ring shrink-0 text-brand-blue" href="#privasi">
              Privasi
            </a>
            <a className="focus-ring shrink-0 text-brand-blue" href="#blokir">
              Blokir
            </a>
            <a className="focus-ring shrink-0 text-brand-blue" href="#notifikasi">
              Notifikasi
            </a>
            <a className="focus-ring shrink-0 text-brand-blue" href="#akun">
              Akun
            </a>
            <a className="focus-ring shrink-0 text-brand-blue" href="/app/membership">
              StudyDate Plus
            </a>
          </nav>

          <div className="mt-8">
            <SettingsSection
              id="profil"
              title="Profil"
              description="Kelola informasi yang membantu kamu ditemukan oleh partner belajar."
            >
              <div className="rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6 text-brand-muted sm:px-5">
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
                    Terlihat sebelum private reveal
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">
                    Alias anonim, maskot resmi, kampus, program studi, semester,
                    wilayah umum, intro singkat, minat, tujuan, dan badge
                    verifikasi hanya bila statusnya benar-benar verified.
                  </p>
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-brand-navy">
                    Privat secara default
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">
                    Nama depan/belakang privat, email, NIM, identitas legal,
                    lokasi presisi, foto wajah, dan kontak tidak tampil di
                    People.
                  </p>
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-brand-navy">
                    Dibuka melalui persetujuan existing
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">
                    Identity Reveal membuka nama depan dan foto yang disiapkan
                    untuk percakapan itu. Contact Reveal membuka Telegram,
                    Instagram, atau LinkedIn per saluran setelah persetujuan dua
                    arah. StudyDate tidak menjanjikan anonimitas atau keamanan
                    mutlak.
                  </p>
                </div>
              </div>
              <p className="mt-6 text-sm leading-6 text-brand-muted">
                V1 memakai satu safe projection global yang sama dengan People.
                Toggle per-field dan riwayat consent satu sisi tidak tersedia.
                Baca juga{" "}
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
              description="Pilih notifikasi in-app yang ingin kamu terima. Email, browser push, SMS, dan Telegram tetap nonaktif."
            >
              <div className="divide-y divide-brand-border rounded-xl border border-brand-border bg-white">
                {notificationPreferences.map((preference) => (
                  <form
                    key={preference.type}
                    action={updateNotificationPreference}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <input type="hidden" name="type" value={preference.type} />
                    <span className="break-words text-sm font-semibold text-brand-navy">
                      {preference.type.replaceAll("_", " ")}
                    </span>
                    <button
                      name="enabled"
                      value={preference.inAppEnabled ? "false" : "true"}
                      className="focus-ring min-h-10 shrink-0 rounded-lg border border-brand-border px-3 text-xs font-semibold"
                    >
                      {preference.inAppEnabled ? "Aktif" : "Nonaktif"}
                    </button>
                  </form>
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              id="paket"
              title="StudyDate Plus"
              description="Paket menentukan kapasitas People, perkenalan, dan Circle. Privasi dan keamanan tetap sama."
            >
              <Link
                href="/app/membership"
                className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-navy hover:border-brand-blue"
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
                    className="focus-ring min-h-11 rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-navy hover:border-brand-blue hover:text-brand-blue"
                  >
                    Keluar
                  </button>
                </form>
              </div>
              <p className="mt-4 text-sm leading-6 text-brand-muted">
                Keluar dari semua perangkat ditunda. Supabase mendukung global
                sign-out, tetapi token akses yang sudah terbit tetap dapat
                berlaku sampai kedaluwarsa; StudyDate tidak membuat revocation
                buatan sendiri.
              </p>
              <TelegramCompanionSetting initialState={telegramCompanion} />
              <AccountDangerZone />
            </SettingsSection>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan pengaturan…
          </p>
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
