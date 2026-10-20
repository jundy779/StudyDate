/**
 * Daftar kanal resmi StudyDate yang bisa diisi Owner. Aman dipakai di client.
 * Harus sejalan dengan public.contact_link_host_allowed di migration 202610200002.
 */

export const CONTACT_LINK_KINDS = [
  "whatsapp",
  "telegram",
  "telegram_channel",
  "telegram_group",
  "telegram_bot",
  "instagram",
  "threads",
  "x",
  "facebook",
  "youtube",
  "email",
] as const;

export type ContactLinkKind = (typeof CONTACT_LINK_KINDS)[number];

export type ContactLink = { kind: ContactLinkKind; url: string };

export const CONTACT_LINK_META: Record<
  ContactLinkKind,
  { label: string; hint: string; placeholder: string; hosts: string[] }
> = {
  whatsapp: {
    label: "WhatsApp",
    hint: "Nomor atau grup WhatsApp resmi.",
    placeholder: "https://wa.me/62812xxxxxxx",
    hosts: ["wa.me", "api.whatsapp.com", "chat.whatsapp.com", "whatsapp.com", "www.whatsapp.com"],
  },
  telegram: {
    label: "Telegram",
    hint: "Akun Telegram admin untuk pertanyaan.",
    placeholder: "https://t.me/namaakun",
    hosts: ["t.me", "telegram.me"],
  },
  telegram_channel: {
    label: "Kanal Telegram",
    hint: "Kanal pengumuman StudyDate.",
    placeholder: "https://t.me/namakanal",
    hosts: ["t.me", "telegram.me"],
  },
  telegram_group: {
    label: "Grup Telegram",
    hint: "Grup komunitas StudyDate.",
    placeholder: "https://t.me/namagrup",
    hosts: ["t.me", "telegram.me"],
  },
  telegram_bot: {
    label: "Bot Telegram",
    hint: "Aktifkan hanya setelah bot benar-benar dibuka untuk pengguna.",
    placeholder: "https://t.me/StudyDateBot",
    hosts: ["t.me", "telegram.me"],
  },
  instagram: {
    label: "Instagram",
    hint: "Profil Instagram resmi.",
    placeholder: "https://www.instagram.com/namaakun",
    hosts: ["instagram.com", "www.instagram.com"],
  },
  threads: {
    label: "Threads",
    hint: "Profil Threads resmi.",
    placeholder: "https://www.threads.com/@namaakun",
    hosts: ["threads.net", "www.threads.net", "threads.com", "www.threads.com"],
  },
  x: {
    label: "X",
    hint: "Akun X resmi.",
    placeholder: "https://x.com/namaakun",
    hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
  },
  facebook: {
    label: "Facebook",
    hint: "Halaman Facebook resmi.",
    placeholder: "https://www.facebook.com/namahalaman",
    hosts: ["facebook.com", "www.facebook.com", "fb.com", "m.facebook.com"],
  },
  youtube: {
    label: "YouTube",
    hint: "Kanal YouTube resmi.",
    placeholder: "https://www.youtube.com/@namakanal",
    hosts: ["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"],
  },
  email: {
    label: "Email",
    hint: "Alamat email dukungan, ditulis sebagai mailto:.",
    placeholder: "mailto:halo@studydate.id",
    hosts: [],
  },
};

/** Validasi yang sama dengan database, untuk pesan galat yang jelas di form. */
export function isAllowedContactUrl(kind: ContactLinkKind, url: string) {
  const value = url.trim();
  if (kind === "email") return /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
  const match = /^https:\/\/([^/?#:]+)/i.exec(value);
  if (!match || /[\s<>"]/.test(value) || value.length > 300) return false;
  return CONTACT_LINK_META[kind].hosts.includes(match[1].toLowerCase());
}
