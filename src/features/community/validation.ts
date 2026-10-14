import type { CircleFormInput, EventFormInput } from "@/features/community/types";

const contactPattern = /(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|https?:\/\/|www\.|(?:\+?62|0)8\d{7,}|@[a-z0-9_]{3,})/i;

export function validateCircleForm(input: CircleFormInput) {
  if (input.name.trim().length < 4 || input.name.trim().length > 80) return "Nama Circle harus 4 sampai 80 karakter.";
  if (input.description.trim().length < 20 || input.description.trim().length > 600) return "Deskripsi Circle harus 20 sampai 600 karakter.";
  if (/<[^>]+>/.test(`${input.name} ${input.description}`)) return "Gunakan teks biasa tanpa kode HTML.";
  if (contactPattern.test(`${input.name} ${input.description}`)) return "Jangan cantumkan kontak atau akun sosial pada Circle.";
  if (!Number.isInteger(input.memberLimit) || input.memberLimit < 3 || input.memberLimit > 30) return "Batas anggota harus 3 sampai 30 orang.";
  return null;
}

const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function validateEventForm(input: EventFormInput) {
  if (input.title.trim().length < 5 || input.title.trim().length > 100) return "Nama acara harus 5 sampai 100 karakter.";
  if (input.description.trim().length < 20 || input.description.trim().length > 1000) return "Deskripsi acara harus 20 sampai 1.000 karakter.";
  if (/<[^>]+>/.test(`${input.title} ${input.description}`)) return "Gunakan teks biasa tanpa kode HTML.";
  if (contactPattern.test(`${input.title} ${input.description}`)) return "Jangan cantumkan kontak atau akun sosial pada deskripsi acara.";
  if (!localDateTimePattern.test(input.startsAtLocal) || !localDateTimePattern.test(input.endsAtLocal)) return "Isi waktu dengan format YYYY-MM-DDTHH:mm.";
  const startsAt = new Date(`${input.startsAtLocal}:00`); const endsAt = new Date(`${input.endsAtLocal}:00`);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || startsAt >= endsAt) return "Waktu selesai harus setelah waktu mulai.";
  if (input.venueName.trim().length < 3 || input.venueName.trim().length > 120) return "Nama tempat harus 3 sampai 120 karakter.";
  if (input.venueArea.trim().length < 8 || input.venueArea.trim().length > 240) return "Tulis alamat atau area tempat dengan lebih jelas.";
  if (input.city.trim().length < 2 || input.city.trim().length > 100) return "Nama kota harus 2 sampai 100 karakter.";
  if (!Number.isInteger(input.capacity) || input.capacity < 3 || input.capacity > 200) return "Kapasitas harus 3 sampai 200 peserta.";
  if (!input.safetyConfirmed) return "Setujui aturan keamanan acara sebelum melanjutkan.";
  return null;
}
