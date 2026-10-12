export const INTRODUCTION_MESSAGE_MIN = 12;
export const INTRODUCTION_MESSAGE_MAX = 300;

const contactPatterns = [
  /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i,
  /https?:\/\/|www\.|t\.me\/|telegram\.me\/|wa\.me\/|bit\.ly\/|tinyurl\.com\/|instagram\.com\//i,
  /whatsapp|telegram|instagram|\binsta\b|discord\.gg/i,
  /@[a-z0-9_]{3,}/i,
];

export function normalizeIntroductionMessage(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function openingMessageHasContact(value: string) {
  const normalized = normalizeIntroductionMessage(value).toLowerCase();
  if (contactPatterns.some((pattern) => pattern.test(normalized))) return true;
  return normalized.replace(/[^0-9]/g, "").length >= 8;
}

export function validateIntroductionMessage(value: string) {
  const normalized = normalizeIntroductionMessage(value);

  if (normalized.length < INTRODUCTION_MESSAGE_MIN) {
    return { value: normalized, error: `Tulis minimal ${INTRODUCTION_MESSAGE_MIN} karakter.` };
  }
  if (normalized.length > INTRODUCTION_MESSAGE_MAX) {
    return { value: normalized, error: `Maksimal ${INTRODUCTION_MESSAGE_MAX} karakter.` };
  }
  if (openingMessageHasContact(normalized)) {
    return {
      value: normalized,
      error: "Simpan nomor, email, dan akun sosial untuk nanti. Kenalan dulu lewat chat StudyDate.",
    };
  }

  return { value: normalized, error: null };
}
