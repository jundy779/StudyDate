export const CHAT_MESSAGE_MIN = 1;
export const CHAT_MESSAGE_MAX = 1000;

const contactPatterns = [
  /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i,
  /https?:\/\/|www\.|t\.me\/|telegram\.me\/|wa\.me\/|bit\.ly\/|tinyurl\.com\/|instagram\.com\//i,
  /whatsapp|telegram|instagram|\binsta\b|discord\.gg/i,
  /@[a-z0-9_]{3,}/i,
];

export function normalizeChatMessage(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chatMessageHasContact(value: string) {
  const normalized = normalizeChatMessage(value).toLowerCase();
  if (contactPatterns.some((pattern) => pattern.test(normalized))) return true;
  return normalized.replace(/[^0-9]/g, "").length >= 8;
}

export function validateChatMessage(value: string) {
  const normalized = normalizeChatMessage(value);
  if (normalized.length < CHAT_MESSAGE_MIN) {
    return { value: normalized, error: "Tulis pesan terlebih dahulu." };
  }
  if (normalized.length > CHAT_MESSAGE_MAX) {
    return { value: normalized, error: `Maksimal ${CHAT_MESSAGE_MAX} karakter.` };
  }
  if (chatMessageHasContact(normalized)) {
    return {
      value: normalized,
      error: "Simpan kontak untuk tahap berikutnya. Kenalan dulu lewat chat StudyDate.",
    };
  }
  return { value: normalized, error: null };
}

export function validateReportDetails(value: string) {
  const normalized = normalizeChatMessage(value);
  if (normalized.length > 300) return "Maksimal 300 karakter.";
  if (normalized && chatMessageHasContact(normalized)) {
    return "Jangan masukkan nomor, email, akun sosial, atau tautan.";
  }
  return null;
}
