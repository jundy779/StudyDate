import {
  Handshake,
  IdCard,
  Link2,
  MessageSquare,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export const NOTIFICATION_TYPES = [
  "INTRODUCTION_RECEIVED",
  "INTRODUCTION_ACCEPTED",
  "MESSAGE_RECEIVED",
  "MUTUAL_INTEREST_COMPLETED",
  "IDENTITY_REVEAL_COMPLETED",
  "CONTACT_REVEAL_COMPLETED",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationChannel = "telegram" | "instagram" | "linkedin";

export type NotificationItem = {
  publicId: string;
  type: NotificationType;
  targetPath: string;
  channel: NotificationChannel | null;
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
    default: {
      const exhaustive: never = item.type;
      throw new Error(`Unsupported notification type: ${exhaustive}`);
    }
  }
}
