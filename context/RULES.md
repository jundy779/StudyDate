# StudyDate Agent Rules

## 1. Wajib membaca context

Sebelum bekerja, baca `context/RULES.md`, `context/PRD.md`, `context/ARCHITECTURE.md`,
`context/SCHEMA.md`, dan `context/DESIGN.md`, lalu periksa kode aktual.

Jangan menebak struktur file, package, route, schema, migration, atau komponen.

## 2. Scope control

Kerjakan hanya scope yang diminta.

Dilarang:
- menambahkan fitur yang belum diminta;
- merombak halaman yang sudah disetujui;
- membuat data, user, event, review, statistik, atau rekomendasi palsu;
- membuat swipe interface atau bahasa dating-app;
- menambahkan dependency tanpa kebutuhan nyata;
- mengubah copy produk tanpa instruksi;
- mengganti logo atau mascot resmi;
- membangun fitur lain hanya karena dianggap “sekalian”.

## 3. Frozen areas

Sampai ada instruksi eksplisit, anggap frozen:
- visual landing page;
- hero spacing;
- privacy-section mascot placement;
- Early Access waitlist UI dan alur;
- login, onboarding, dan `/app` setelah live verification;
- logo, warna, tipografi, mascot, serta brand direction.

Perbaikan bug, accessibility, security, dan responsive regression tetap diperbolehkan tanpa redesign luas.

## 4. Product boundaries

StudyDate ID adalah platform koneksi mahasiswa berbasis People, Groups, Campus Events, private introduction, anonymous
conversation, progressive reveal, mutual consent, online-first interaction, dan public-place-only offline meetings.

StudyDate bukan marketplace tutor, job board, random chat, fast-swipe app, atau layanan yang menjamin hubungan romantis
maupun keamanan 100%.

## 5. Privacy rules

Jangan tampilkan kepada user lain secara default:
- nama lengkap;
- Telegram ID/username;
- Instagram, WhatsApp, email, atau nomor telepon;
- alamat dan lokasi presisi;
- dokumen verifikasi;
- auth metadata dan internal user ID.

Identity Reveal hanya membuka nama depan, foto jelas yang disetujui, dan status verifikasi.

Setiap jenis kontak memerlukan persetujuan dua arah terpisah. Jangan memakai satu flag global untuk membuka seluruh
identitas dan kontak.

Student Verification Center harus tetap opsional. Pencocokan data akademik PDDikti saja tidak membuktikan kepemilikan
akun. Badge hanya boleh diberikan bila data akademik cocok dan kepemilikan dibuktikan melalui email kampus
terverifikasi atau review kartu mahasiswa yang disetujui. NIM, nama legal, kode, dan dokumen tidak boleh disimpan atau
ditampilkan sebagai plaintext.

Jika NIM ditawarkan saat onboarding, field harus opsional, disimpan terenkripsi di luar `profiles`, dan tidak boleh
mengaktifkan verification atau discoverability secara otomatis.

## 6. Safety rules

Pertemuan offline hanya di tempat umum yang ramai, terang, mudah diakses, dan masih beroperasi. Lokasi pribadi tidak
diperbolehkan.

Daftar detail lokasi terlarang tidak perlu diulang pada semua halaman publik. Simpan detail pada Safety Center, meeting
confirmation, Community Guidelines, dan bot safety reminder.

Sediakan block, report, leave/end, cancel meeting, dan safety check bila relevan. Jangan mengklaim verifikasi sebagai
jaminan perilaku.

## 7. Authentication and authorization

- Gunakan Supabase passwordless email auth.
- Gunakan PKCE dan server-side session handling.
- Jangan percaya client-side auth state untuk authorization.
- Protected Server Components wajib memverifikasi sesi kembali.
- Redirect hanya ke path internal yang diizinkan.
- Jangan log token, OTP, magic link, cookie, email, atau private profile data.
- Service-role key hanya di server dan tidak boleh memakai prefix `NEXT_PUBLIC_`.

## 8. Database changes

Sebelum migration:
- periksa seluruh migration lokal;
- identifikasi project Supabase yang benar;
- bandingkan migration history lokal dan remote;
- jangan menjalankan migration pada project yang belum diverifikasi.

Migration harus memakai constraints, RLS, grant minimum, dan SECURITY DEFINER dengan `search_path` eksplisit. Gunakan
`auth.uid()` sebagai target user dan jangan mempercayai `user_id` dari client.

Jangan menjalankan `db push` tanpa persetujuan eksplisit setelah preflight.

## 9. Validation

Semua input divalidasi ulang di server. Trim string, normalize array/email, reject unknown values, enforce maximum
lengths, reject protected fields, limit payload, dan tampilkan generic error.

## 10. Accessibility

UI baru harus keyboard-accessible, punya focus state jelas, label form, error announcement, urutan fokus logis,
Escape/focus restore untuk dialog, reduced motion, touch target memadai, dan tidak horizontal overflow.

## 11. Design discipline

Gunakan existing StudyDate tokens dan gaya editorial campus-tech. Hindari generic SaaS dashboard, AI gradients
berlebihan, card untuk semua hal, fake match percentage, swipe language, dan visual dating-app.

## 12. Required checks

Jalankan script yang benar-benar tersedia di `package.json`:

- `npm run lint`
- `npm run typecheck`
- `npm run test:auth`
- `npm run test:browser` saat server dan Chrome tersedia
- `npm run build`
- `npm run check` untuk lint, typecheck, dan build dalam satu perintah

Periksa 375px, 768px, 1024px, 1440px, keyboard, focus, overflow, loading, empty, success, dan error states.

Jangan mengklaim live Supabase test lulus bila hanya diuji dengan mock atau static SQL audit.

## 13. Final report

Pisahkan dengan jelas:
- perubahan;
- test lokal;
- test live;
- hal yang belum diuji;
- migration manual;
- environment variable;
- risiko tersisa.

Jangan menampilkan secret, key, password, token, OTP, magic link, atau email pengguna.
