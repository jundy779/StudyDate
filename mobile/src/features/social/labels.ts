import type {
  IntroductionEligibilityState,
  IntroductionStatus,
  StudyStatus,
} from "@/features/social/types";

const interestLabels: Record<string, string> = {
  technology: "Teknologi",
  design: "Desain",
  business: "Bisnis",
  languages: "Bahasa",
  books: "Buku",
  film: "Film",
  music: "Musik",
  sports: "Olahraga",
  organizations: "Organisasi",
  career: "Karier",
  research: "Riset",
  volunteering: "Kegiatan sosial",
};

const goalLabels: Record<string, string> = {
  study: "Teman belajar",
  friendship: "Teman baru",
  networking: "Memperluas relasi",
  collaboration: "Kolaborasi",
  campus_activities: "Kegiatan kampus",
  meaningful_connection: "Koneksi yang berarti",
};

export const studyStatusLabels: Record<StudyStatus, string> = {
  study_friend: "Lagi cari teman belajar",
  discussion_friend: "Lagi cari teman diskusi",
  project_friend: "Lagi cari teman ngerjain proyek",
};

export const introductionStatusLabels: Record<IntroductionStatus, string> = {
  pending: "Menunggu jawaban",
  accepted: "Perkenalan diterima",
  declined: "Perkenalan ditolak",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

const eligibilityMessages: Record<IntroductionEligibilityState, string> = {
  ok: "Kamu bisa mengirim perkenalan.",
  self: "Kamu tidak bisa mengirim perkenalan ke akun sendiri.",
  unavailable: "Profil ini sedang tidak menerima perkenalan.",
  pending: "Perkenalanmu masih menunggu jawaban.",
  cooldown: "Beri jeda dulu sebelum mengirim perkenalan lagi.",
  rate_limited: "Kamu sudah mengirim beberapa perkenalan. Coba lagi nanti.",
  quota_reached: "Kuota perkenalan harianmu sudah terpakai.",
  blocked: "Perkenalan tidak dapat dikirim ke profil ini.",
};

export function getInterestLabel(value: string) {
  return interestLabels[value] ?? value;
}

export function getGoalLabel(value: string) {
  return goalLabels[value] ?? value;
}

export function getEligibilityMessage(value: string) {
  return eligibilityMessages[value as IntroductionEligibilityState]
    ?? "Perkenalan belum dapat dikirim. Coba lagi sebentar.";
}
