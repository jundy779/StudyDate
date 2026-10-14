import type { CircleFormInput } from "@/features/community/types";

const contactPattern = /(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|https?:\/\/|www\.|(?:\+?62|0)8\d{7,}|@[a-z0-9_]{3,})/i;

export function validateCircleForm(input: CircleFormInput) {
  if (input.name.trim().length < 4 || input.name.trim().length > 80) return "Nama Circle harus 4 sampai 80 karakter.";
  if (input.description.trim().length < 20 || input.description.trim().length > 600) return "Deskripsi Circle harus 20 sampai 600 karakter.";
  if (/<[^>]+>/.test(`${input.name} ${input.description}`)) return "Gunakan teks biasa tanpa kode HTML.";
  if (contactPattern.test(`${input.name} ${input.description}`)) return "Jangan cantumkan kontak atau akun sosial pada Circle.";
  if (!Number.isInteger(input.memberLimit) || input.memberLimit < 3 || input.memberLimit > 30) return "Batas anggota harus 3 sampai 30 orang.";
  return null;
}
