/** Stable production-relative public document routes (studydate.id). */
export const PUBLIC_DOC_ROUTES = [
  {
    path: "/privacy",
    label: "Privasi",
    title: "Kebijakan Privasi",
    description:
      "Bagaimana StudyDate ID mengumpulkan, memakai, dan melindungi data akun, profil anonim, percakapan, serta fitur reveal.",
  },
  {
    path: "/terms",
    label: "Ketentuan",
    title: "Ketentuan Layanan",
    description:
      "Aturan penggunaan StudyDate ID sebagai platform social mahasiswa: akun, perilaku, reveal, dan pertemuan di tempat umum.",
  },
  {
    path: "/community-guidelines",
    label: "Pedoman Komunitas",
    title: "Pedoman Komunitas",
    description:
      "Norma komunitas StudyDate ID: saling menghormati, tanpa pelecehan, scam, doxxing, atau tekanan reveal.",
  },
  {
    path: "/safety",
    label: "Keamanan",
    title: "Pusat Keamanan",
    description:
      "Prinsip anonymous-first, tip keamanan akun, block/lapor, dan pertemuan offline hanya di tempat umum.",
  },
  {
    path: "/help",
    label: "Bantuan",
    title: "Bantuan",
    description:
      "Panduan singkat StudyDate ID: People, Perkenalan, chat anonim, Mutual Interest, Identity Reveal, Contact Reveal, dan login.",
  },
] as const;

export const PUBLIC_DOC_LAST_UPDATED_ISO = "2026-08-10";
export const PUBLIC_DOC_LAST_UPDATED_LABEL = "10 Agustus 2026";

/** Intended production URLs for Search Console / OAuth readiness (documentation). */
export const PRODUCTION_PUBLIC_URLS = [
  "https://studydate.id/",
  "https://studydate.id/privacy",
  "https://studydate.id/terms",
  "https://studydate.id/community-guidelines",
  "https://studydate.id/safety",
  "https://studydate.id/help",
] as const;
