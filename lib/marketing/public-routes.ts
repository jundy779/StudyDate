/** Stable production-relative public document routes (studydate.id). */
export const PUBLIC_DOC_ROUTES = [
  {
    path: "/about",
    label: "Tentang",
    title: "Tentang StudyDate ID",
    description:
      "Alasan StudyDate dibangun, cara menggunakannya, fokus awal, dan peluang kerja sama untuk lingkungan kampus.",
  },
  {
    path: "/insight",
    label: "Insight",
    title: "Insight Mahasiswa",
    description:
      "Panduan praktis tentang teman belajar, koneksi mahasiswa, privasi, dan pertemuan yang aman.",
  },
  {
    path: "/privacy",
    label: "Privasi",
    title: "Kebijakan Privasi",
    description:
      "Bagaimana StudyDate ID mengumpulkan, memakai, dan melindungi data akun, profil tanpa nama asli, percakapan, identitas, dan kontak.",
  },
  {
    path: "/terms",
    label: "Ketentuan",
    title: "Ketentuan Layanan",
    description:
      "Aturan penggunaan StudyDate ID: akun, perilaku, pembagian identitas dan kontak, serta pertemuan di tempat umum.",
  },
  {
    path: "/community-guidelines",
    label: "Pedoman Komunitas",
    title: "Pedoman Komunitas",
    description:
      "Norma komunitas StudyDate ID: saling menghormati, tanpa pelecehan, penipuan, penyebaran data pribadi, atau tekanan membuka identitas.",
  },
  {
    path: "/safety",
    label: "Keamanan",
    title: "Pusat Keamanan",
    description:
      "Panduan menjaga identitas dan kontak, keamanan akun, blokir/lapor, serta pertemuan hanya di tempat umum.",
  },
  {
    path: "/help",
    label: "Bantuan",
    title: "Bantuan",
    description:
      "Panduan singkat untuk mencari teman, mengirim perkenalan, ngobrol tanpa nama asli, membagikan identitas dan kontak, serta masuk ke akun.",
  },
] as const;

export const PUBLIC_DOC_LAST_UPDATED_ISO = "2026-09-08";
export const PUBLIC_DOC_LAST_UPDATED_LABEL = "8 September 2026";

/** Intended production URLs for Search Console / OAuth readiness (documentation). */
export const PRODUCTION_PUBLIC_URLS = [
  "https://studydate.id/",
  "https://studydate.id/about",
  "https://studydate.id/insight",
  "https://studydate.id/insight/apa-itu-study-date",
  "https://studydate.id/privacy",
  "https://studydate.id/terms",
  "https://studydate.id/community-guidelines",
  "https://studydate.id/safety",
  "https://studydate.id/help",
] as const;
