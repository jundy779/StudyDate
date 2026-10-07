export const CHAT_SHARE_KINDS = ["circle", "event"] as const;

export type ChatShareKind = (typeof CHAT_SHARE_KINDS)[number];

export type ChatShareableItem = {
  share_kind: ChatShareKind;
  public_slug: string;
  title: string;
  description: string;
  meta: string;
  starts_at: string | null;
  timezone_name: string | null;
};

export const CHAT_SHARE_KIND_LABELS: Record<ChatShareKind, string> = {
  circle: "Circle belajar",
  event: "Acara kampus",
};

const CIRCLE_TOPIC_LABELS: Record<string, string> = {
  coding: "Coding & teknologi",
  data_science: "Data & AI",
  design: "Desain",
  mathematics: "Matematika",
  languages: "Bahasa",
  thesis: "Tugas akhir",
  exam_prep: "Persiapan ujian",
  general: "Belajar bareng",
  other: "Topik lainnya",
};

export function getChatShareHref(kind: ChatShareKind, publicSlug: string) {
  if (kind === "circle" && /^circle-[0-9a-f]{24}$/.test(publicSlug)) {
    return `/app/circles/${publicSlug}`;
  }
  if (kind === "event" && /^event-[0-9a-f]{24}$/.test(publicSlug)) {
    return `/app/events/${publicSlug}`;
  }
  return null;
}

export function getChatShareMetaLabel(item: {
  share_kind: ChatShareKind;
  meta: string;
}) {
  return item.share_kind === "circle"
    ? (CIRCLE_TOPIC_LABELS[item.meta] ?? "Circle belajar")
    : item.meta;
}
