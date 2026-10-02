import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("public guidance avoids internal product and developer wording", () => {
  const publicCopy = [
    read("components/marketing/landing-page.tsx"),
    read("app/(public-docs)/about/page.tsx"),
    read("content/public-docs/help.ts"),
    read("content/public-docs/safety.ts"),
    read("content/public-docs/privacy.ts"),
  ].join("\n");

  assert.doesNotMatch(
    publicCopy,
    /fallback manual|menyelesaikan onboarding|Unread dihitung|pada v1|sumber CTA|academic match|nama legal|title:\s*"Retensi\b|profil anonim|ruang privat anonim/i,
  );
  assert.match(publicCopy, /profil tanpa nama asli/i);
  assert.match(publicCopy, /belum dibuka untuk semua pengguna/i);
});

test("student verification explains choices without operational jargon", () => {
  const studentCopy = [
    read("app/app/verification/page.tsx"),
    read("components/verification/verification-form.tsx"),
    read("components/onboarding/onboarding-form.tsx"),
  ].join("\n");

  assert.doesNotMatch(
    studentCopy,
    /Selesaikan Onboarding|nama legal|pemeriksaan manual|pilot ini|Badge hanya/i,
  );
  assert.match(studentCopy, /diperiksa oleh petugas/i);
  assert.match(studentCopy, /lama penyimpanan/i);
});

test("admin and owner surfaces hide internal identifiers and source labels", () => {
  const staffCopy = [
    read("app/owner/events/page.tsx"),
    read("app/admin/events/page.tsx"),
    read("components/staff/onboarding-catalog-directory.tsx"),
    read("components/staff/study-program-directory.tsx"),
    read("components/staff/campus-directory.tsx"),
  ].join("\n");

  assert.doesNotMatch(
    staffCopy,
    /Slug publik acara|Alias publik mahasiswa|Manual user|Setujui ke list|saran onboarding|Input tidak valid/i,
  );
  assert.doesNotMatch(
    read("app/admin/events/page.tsx"),
    />\{event\.public_slug\}<\/p>/,
  );
  assert.match(staffCopy, /Nama samaran mahasiswa/);
  assert.match(staffCopy, /Setujui dan tampilkan/);
});

test("student, event, and staff copy stays easy to understand", () => {
  const landing = read("components/marketing/landing-page.tsx");
  const productCopy = [
    read("components/events/event-form.tsx"),
    read("app/owner/page.tsx"),
    read("app/admin/page.tsx"),
    read("lib/identity-reveal/constants.ts"),
    read("lib/contact-reveal/constants.ts"),
    read("app/app/verification/page.tsx"),
  ].join("\n");

  assert.doesNotMatch(
    landing,
    /Temukan koneksi baru|Ingin terhubung lewat|Jejaring/,
  );
  assert.match(landing, /Temukan teman baru/);
  assert.doesNotMatch(
    productCopy,
    /Relasi profesional|teks biasa tanpa HTML|>Cakupan<|keterlihatan profil|alamat publiknya|verifikasi biometrik|lawan bicara|pengujian terkontrol/i,
  );
  assert.match(productCopy, /Siapa yang bisa ikut/);
  assert.match(productCopy, /Foto ini tidak dipakai untuk mengenali wajah secara otomatis/);
  assert.match(productCopy, /apakah profil mereka bisa ditemukan/);
});
