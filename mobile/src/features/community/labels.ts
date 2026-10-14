import type { CircleTopic, EventCategory, EventRegistrationStatus } from "@/features/community/types";

export const circleTopicLabels: Record<CircleTopic, string> = {
  coding: "Coding", data_science: "Data Science", design: "Desain", mathematics: "Matematika",
  languages: "Bahasa & IELTS", thesis: "Skripsi / Tesis", exam_prep: "Persiapan ujian",
  general: "Belajar umum", other: "Lainnya",
};

export const eventCategoryLabels: Record<EventCategory, string> = {
  study_together: "Belajar bareng", coding_tech: "Coding & teknologi", design: "Desain",
  languages: "Bahasa", thesis: "Skripsi / tesis", exam_prep: "Persiapan ujian",
  workshop: "Workshop", discussion: "Diskusi", networking: "Networking", community: "Komunitas",
  seminar: "Seminar", meetup: "Meetup", hackathon: "Hackathon", other: "Lainnya",
};

export const eventStatusLabels: Record<EventRegistrationStatus, string> = {
  pending: "Menunggu persetujuan", going: "Kamu terdaftar", waitlisted: "Masuk daftar tunggu",
  declined: "Pendaftaran ditolak", cancelled: "Pendaftaran dibatalkan",
};

export function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Jadwal belum tersedia";
  return new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}
