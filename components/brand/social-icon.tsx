import { Bot, Mail, Megaphone, UsersRound } from "lucide-react";
import {
  siFacebook,
  siInstagram,
  siTelegram,
  siThreads,
  siWhatsapp,
  siX,
  siYoutube,
} from "simple-icons";
import type { ContactLinkKind } from "@/lib/marketing/contact-links-config";

const BRAND_PATHS: Partial<Record<ContactLinkKind, string>> = {
  whatsapp: siWhatsapp.path,
  telegram: siTelegram.path,
  instagram: siInstagram.path,
  threads: siThreads.path,
  x: siX.path,
  facebook: siFacebook.path,
  youtube: siYoutube.path,
};

/**
 * Ikon kanal resmi. Logo merek dari Simple Icons (CC0) dipakai hanya untuk
 * menautkan ke akun StudyDate di platform tersebut. Kanal, grup, dan bot
 * Telegram memakai ikon pembeda supaya tidak tertukar.
 */
export function SocialIcon({
  kind,
  className = "h-5 w-5",
}: {
  kind: ContactLinkKind;
  className?: string;
}) {
  if (kind === "email") return <Mail className={className} aria-hidden="true" />;
  if (kind === "telegram_channel") return <Megaphone className={className} aria-hidden="true" />;
  if (kind === "telegram_group") return <UsersRound className={className} aria-hidden="true" />;
  if (kind === "telegram_bot") return <Bot className={className} aria-hidden="true" />;

  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d={BRAND_PATHS[kind]} />
    </svg>
  );
}
