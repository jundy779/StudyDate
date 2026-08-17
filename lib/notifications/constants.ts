import {
  CalendarClock,
  CalendarX2,
  Handshake,
  IdCard,
  Link2,
  MapPin,
  MessageSquare,
  Sparkles,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";

export const NOTIFICATION_TYPES = [
  "INTRODUCTION_RECEIVED",
  "INTRODUCTION_ACCEPTED",
  "MESSAGE_RECEIVED",
  "MUTUAL_INTEREST_COMPLETED",
  "IDENTITY_REVEAL_COMPLETED",
  "CONTACT_REVEAL_COMPLETED",
  "CIRCLE_MEMBER_JOINED",
  "CIRCLE_UPDATED",
  "CIRCLE_ARCHIVED",
  "CIRCLE_MEMBER_REMOVED",
  "EVENT_REGISTERED",
  "EVENT_SCHEDULE_CHANGED",
  "EVENT_LOCATION_CHANGED",
  "EVENT_CANCELLED",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationChannel = "telegram" | "instagram" | "linkedin";

export type NotificationItem = {
  publicId: string;
  type: NotificationType;
  targetPath: string;
  channel: NotificationChannel | null;
  headline?: string | null;
  whenLabel?: string | null;
  venueLabel?: string | null;
  createdAt: string;
  readAt: string | null;
};

export type NotificationCopy = {
  title: string;
  description: string;
  Icon: LucideIcon;
};

const contactLabels: Record<NotificationChannel, string> = {
  telegram: "Telegram",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

function quotedHeadline(value: string | null | undefined, fallback: string) {
  const headline = value?.trim();
  if (!headline) return fallback;
  return `“${headline}”`;
}

export function getNotificationCopy(item: NotificationItem): NotificationCopy {
  switch (item.type) {
    case "INTRODUCTION_RECEIVED":
      return {
        title: "Perkenalan baru",
        description: "Ada seseorang yang ingin berkenalan lewat StudyDate.",
        Icon: Handshake,
      };
    case "INTRODUCTION_ACCEPTED":
      return {
        title: "Perkenalan diterima",
        description: "Percakapan anonim kalian sekarang tersedia.",
        Icon: Handshake,
      };
    case "MESSAGE_RECEIVED":
      return {
        title: "Pesan baru",
        description: "Ada pesan baru di percakapan anonim kamu.",
        Icon: MessageSquare,
      };
    case "MUTUAL_INTEREST_COMPLETED":
      return {
        title: "Kalian sama-sama ingin kenal lebih jauh",
        description: "Mutual Interest sudah tercapai.",
        Icon: Sparkles,
      };
    case "IDENTITY_REVEAL_COMPLETED":
      return {
        title: "Identitas telah dibuka",
        description:
          "Kalian telah menyelesaikan pembukaan identitas dua arah.",
        Icon: IdCard,
      };
    case "CONTACT_REVEAL_COMPLETED": {
      const channel = item.channel ? contactLabels[item.channel] : "Kontak";
      return {
        title: `${channel} telah dibagikan`,
        description: `Kalian telah menyelesaikan pembukaan ${channel} dua arah.`,
        Icon: Link2,
      };
    }
    case "CIRCLE_MEMBER_JOINED":
      return {
        title: "Anggota baru bergabung",
        description: `Ada anggota baru di ${quotedHeadline(item.headline, "Study Circle kamu")}.`,
        Icon: Users,
      };
    case "CIRCLE_UPDATED":
      return {
        title: "Detail Circle berubah",
        description: `${quotedHeadline(item.headline, "Study Circle yang kamu ikuti")} diperbarui.`,
        Icon: Users,
      };
    case "CIRCLE_ARCHIVED":
      return {
        title: "Study Circle ditutup",
        description: `${quotedHeadline(item.headline, "Study Circle yang kamu ikuti")} tidak lagi aktif.`,
        Icon: UserMinus,
      };
    case "CIRCLE_MEMBER_REMOVED":
      return {
        title: "Keanggotaan Study Circle diperbarui",
        description: `Keanggotaan kamu di ${quotedHeadline(item.headline, "Study Circle")} telah diperbarui.`,
        Icon: UserMinus,
      };
    case "EVENT_REGISTERED":
      return {
        title: "Kamu terdaftar di Campus Event",
        description: quotedHeadline(item.headline, "Pendaftaran event kamu berhasil."),
        Icon: CalendarClock,
      };
    case "EVENT_SCHEDULE_CHANGED":
      return {
        title: "Jadwal event berubah",
        description: item.whenLabel
          ? `${quotedHeadline(item.headline, "Campus Event")}. Sekarang: ${item.whenLabel}`
          : quotedHeadline(item.headline, "Jadwal Campus Event telah diperbarui."),
        Icon: CalendarClock,
      };
    case "EVENT_LOCATION_CHANGED":
      return {
        title: "Lokasi event diperbarui",
        description: item.venueLabel
          ? `${quotedHeadline(item.headline, "Campus Event")}. Lokasi: ${item.venueLabel}`
          : quotedHeadline(item.headline, "Lokasi Campus Event telah diperbarui."),
        Icon: MapPin,
      };
    case "EVENT_CANCELLED":
      return {
        title: "Event dibatalkan",
        description: quotedHeadline(item.headline, "Campus Event tidak jadi dilaksanakan."),
        Icon: CalendarX2,
      };
    default: {
      const exhaustive: never = item.type;
      throw new Error(`Unsupported notification type: ${exhaustive}`);
    }
  }
}
