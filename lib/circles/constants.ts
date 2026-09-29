export const CIRCLE_PAGE_SIZE = 12;
export const CIRCLE_MESSAGE_PAGE_SIZE = 50;
export const CIRCLE_NAME_MIN = 4;
export const CIRCLE_NAME_MAX = 80;
export const CIRCLE_DESCRIPTION_MIN = 20;
export const CIRCLE_DESCRIPTION_MAX = 600;
export const CIRCLE_MESSAGE_MAX = 800;
export const CIRCLE_MEMBER_MIN = 3;
export const CIRCLE_MEMBER_MAX = 30;

export const CIRCLE_TOPICS = [
  { value: "coding", label: "Coding" },
  { value: "data_science", label: "Data Science" },
  { value: "design", label: "Desain" },
  { value: "mathematics", label: "Matematika" },
  { value: "languages", label: "Bahasa & IELTS" },
  { value: "thesis", label: "Skripsi / Tesis" },
  { value: "exam_prep", label: "Persiapan ujian" },
  { value: "general", label: "Belajar umum" },
  { value: "other", label: "Lainnya" },
] as const;

export const CIRCLE_SCOPES = [
  {
    value: "open",
    label: "Terbuka untuk StudyDate",
    description: "Mahasiswa dari kampus lain dapat menemukan dan bergabung.",
  },
  {
    value: "campus",
    label: "Kampus yang sama",
    description: "Hanya mahasiswa dengan kampus yang sama dapat menemukan circle.",
  },
] as const;

export type CircleTopic = (typeof CIRCLE_TOPICS)[number]["value"];
export type CircleScope = (typeof CIRCLE_SCOPES)[number]["value"];

export const circleTopicLabels = new Map(
  CIRCLE_TOPICS.map((topic) => [topic.value, topic.label]),
);

export const circleScopeLabels = new Map(
  CIRCLE_SCOPES.map((scope) => [scope.value, scope.label]),
);

export const CIRCLE_CONTACT_MESSAGE =
  "Jangan bagikan kontak di circle. Mulai lewat Perkenalan, lalu bagikan kontak hanya jika kalian berdua setuju.";

export const CIRCLE_GENERIC_ERROR =
  "Study Circle belum dapat diperbarui. Coba lagi sebentar.";
