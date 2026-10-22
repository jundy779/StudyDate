# Production Readiness Audit — 11 Oktober 2026

Status: audit read-only, tidak melakukan migration, perubahan environment, pembuatan akun, penghapusan project, atau mutasi data production.

## 1. Scope

Audit ini memeriksa jalur berikut:

Public browser → Vercel production → halaman landing, Acara, dan Login → kesiapan menuju Supabase.

Alur mahasiswa terautentikasi belum dapat diuji end-to-end karena koneksi Supabase pada sesi audit tidak memiliki akses ke project StudyDate dan belum tersedia dua akun uji yang dapat dipakai tanpa mengubah data production.

## 2. Ringkasan hasil

| Area | Status | Bukti |
|---|---|---|
| Repository main | Lulus pemeriksaan | HEAD terakhir saat audit adalah 829ed09379d5980f408443226b8ee593275e385a. |
| Deployment utama | READY | Project Vercel study-date menjalankan commit yang sama pada production. |
| Domain utama | Terverifikasi | studydate.id terpasang pada project study-date. |
| Redirect domain | Terverifikasi | www.studydate.id, studydate.my.id, www.studydate.my.id, dan studydateid.vercel.app mengarah ke studydate.id. |
| Landing page | Terverifikasi melalui browser | Judul, navigasi, People, Circle, Acara, safety copy, CTA, dan footer dirender. |
| Halaman Acara publik | Terverifikasi melalui browser | Filter kategori, Tersimpan, CTA login, empty state, dan footer dirender. Tidak ada acara resmi yang sedang dipublikasikan. |
| Halaman Login | Terverifikasi melalui browser | Email magic link dan tombol Google tampil setelah hydration. |
| Runtime error Vercel | Tidak ditemukan oleh error cluster | Kedua project tidak melaporkan cluster error pada pemeriksaan 7 hari. Ini bukan bukti seluruh flow berhasil bila trafik rendah. |
| Runtime logs detail | Terbatas | Paket Hobby hanya menyediakan jendela pendek; query 30 menit tidak menemukan function logs karena halaman yang diperiksa dilayani secara statis/cache. |
| Supabase remote migration | Belum dapat diverifikasi | Project StudyDate menolak akses dari koneksi Supabase yang tersedia pada sesi audit. |
| End-to-end dua akun | Belum diuji | Membutuhkan akses project yang benar dan dua akun uji terkontrol. |

## 3. Bukti deployment

### Project production yang menjadi acuan

- Vercel project: study-date
- Project ID: prj_A1nSXsXIT45Jyv0YJOXVjXq9P9fA
- Framework: Next.js
- Node.js: 24.x
- Latest deployment: dpl_9YfbXzEK6c5HecVFGkJQUHGiBbpJ
- Commit: 829ed09379d5980f408443226b8ee593275e385a
- State: READY
- Region yang dilaporkan deployment: iad1
- Domain utama: https://studydate.id

Domain production pada project ini terverifikasi dan tidak melaporkan alias error.

### Project duplikat

Terdapat project kedua:

- Vercel project: study-date-id
- Project ID: prj_tFhCgEmbmBMqMohKJdrwhftnMAIb
- Latest deployment: dpl_FK2ixYr7TBpRyEFj6NRcSa42iYjA
- State: READY
- Domain: study-date-id.vercel.app

Project kedua membangun repository dan commit yang sama, tetapi tidak memiliki custom domain utama maupun environment variable yang terdeteksi. Kondisi ini menambah build ganda dan dapat membingungkan penentuan production source of truth.

Rekomendasi: tetapkan study-date sebagai satu-satunya project production. Jangan menghapus study-date-id sebelum pemilik memastikan tidak ada integrasi, deployment hook, atau kebutuhan rollback yang bergantung padanya. Penghapusan harus menjadi tindakan terpisah dengan persetujuan eksplisit.

## 4. Browser verification

### Landing page

Bukti yang terlihat:

- Title: StudyDate ID — Teman, circle, dan acara kampus
- Headline: Temukan teman baru lewat hal yang kamu suka.
- Navigasi People, Circle Belajar, Acara Kampus, Cara Kerja, Tentang, dan Keamanan tersedia.
- Copy menjelaskan perkenalan anonim dan pembukaan identitas/kontak dengan persetujuan bersama.
- Kategori Event di landing mencakup Seminar, Workshop, Meetup, Hackathon, Komunitas kampus, Kumpul belajar, Kompetisi, serta Acara karier dan kerja bareng.
- Footer publik lengkap dan legal links tersedia.

### Halaman Acara publik

Bukti yang terlihat:

- Halaman dapat dirender setelah hydration.
- Filter Semua, Tersimpan, Belajar bareng, Teknologi & coding, Desain, Bahasa, Skripsi & tesis, Persiapan ujian, Workshop, Diskusi, Karier dan kerja bareng, Komunitas, Seminar, Meetup, Hackathon, dan Lainnya tersedia.
- Empty state menyatakan belum ada acara resmi.
- Public attendee data tidak terlihat.
- Bookmark Tersimpan tersedia, tetapi berdasarkan implementasi repository masih localStorage perangkat.

### Halaman Login

Bukti yang terlihat:

- Form email tampil.
- Copy membatasi domain publik ke gmail.com, vk.com, ac.id, atau sch.id.
- Tombol Lanjutkan dengan Google tampil.
- Akun baru Beta dinyatakan membutuhkan approval Akses Awal.

Browser console hanya mencatat error dari extension metadata cloud browser, bukan error JavaScript yang berasal dari studydate.id.

## 5. Temuan dan prioritas

### BLOCKER — Supabase StudyDate tidak dapat diaudit

Dokumentasi repository merujuk project StudyDate dengan ref ctbqudtvrfezuoqcecyj. Koneksi Supabase yang tersedia hanya menampilkan project qnpgtqlzmubgizkevvhf yang bernama admin@fusionifydigital.cloud's Project dan berstatus INACTIVE.

Permintaan read-only ke project StudyDate menghasilkan permission denied. Akibatnya audit belum dapat membuktikan:

- daftar migration remote;
- migration mana yang pending;
- security advisor;
- performance advisor;
- Auth provider configuration;
- RLS production;
- data Event;
- feature flags di database;
- dua akun uji;
- Student Verification pilot;
- Telegram/notification cron state.

Tindakan berikutnya: hubungkan atau otorisasi project Supabase StudyDate pada konektor yang dipakai untuk audit. Jangan membagikan database password, service-role key, OTP, atau access token melalui chat.

### HIGH — Dua project Vercel membangun repository yang sama

Project study-date dan study-date-id sama-sama terhubung ke main. Hanya study-date yang memegang domain utama dan environment production lengkap.

Dampak:

- build ganda;
- riwayat deployment ganda;
- risiko mengaudit project yang salah;
- risiko environment drift;
- biaya dan waktu build yang tidak perlu.

Tindakan: setelah dependency diperiksa, pertahankan study-date dan arsipkan/hapus duplikat melalui tindakan terpisah yang disetujui.

### HIGH — Status Google OAuth tidak konsisten

Production login menampilkan tombol Google dan code memanggil Supabase signInWithOAuth. File docs/operations/google-oauth-setup.md menyatakan Owner masih harus mengaktifkan provider sebelum tombol bekerja. context/PRD.md masih menyatakan Google OAuth belum aktif.

Belum ada bukti bahwa provider Google benar-benar aktif di Supabase production.

Tindakan:

1. Periksa provider Google pada project Supabase StudyDate.
2. Jika OFF, sembunyikan atau disable tombol dengan penjelasan sederhana.
3. Jika ON, lakukan controlled login test dan perbarui PRD.
4. Pastikan callback URL dan domain allowlist benar.

### HIGH — Migration remote belum bisa dibandingkan dengan 72 migration lokal

Repository memiliki 72 file migration. Tail terbaru mencakup:

- LinkedIn verification;
- kategori Seminar, Meetup, dan Hackathon;
- Anonymous Chat Realtime;
- status belajar 24 jam;
- reply dan reaction;
- sharing Circle/Event lewat chat.

Status repository tidak boleh dianggap sama dengan remote rollout.

Tindakan setelah akses Supabase tersedia:

1. Jalankan list migration secara read-only.
2. Bandingkan seluruh version number.
3. Jalankan Security Advisor dan Performance Advisor.
4. Review plan sebelum db push.
5. Terapkan migration hanya dengan target dan persetujuan eksplisit.
6. Jalankan live audit sintetis dan cleanup.

### MEDIUM — Event publik kosong

Halaman Acara bekerja, tetapi tidak ada Event resmi yang dipublikasikan. Ini bukan error, tetapi membuat fitur unggulan StudyDate terlihat belum hidup.

Tindakan: setelah Event v2 dan migration production dipastikan, publikasikan satu Event pilot nyata atau synthetic yang jelas ditandai untuk controlled QA. Jangan membuat Event palsu seolah-olah nyata.

### MEDIUM — Region function berada di iad1

Deployment melaporkan region iad1, sementara target awal pengguna berada di Indonesia. Halaman statis tetap dilayani CDN, tetapi API/auth/server function dapat mengalami latency lebih tinggi.

Tindakan: ukur latency aktual dari Indonesia ke Vercel function dan Supabase region sebelum memindahkan region. Jangan mengubah region hanya berdasarkan asumsi.

Tindak lanjut 22 Oktober 2026: region Supabase dipastikan Southeast Asia (Singapore). `vercel.json` sekarang memakai `"regions": ["sin1"]` supaya function berada di region yang sama dengan database.

### MEDIUM — Supabase Data API behavior berubah 30 Oktober 2026

Supabase mengumumkan bahwa table/function baru tidak otomatis terekspos ke Data API. Perubahan akan diberlakukan untuk seluruh project lama pada 30 Oktober 2026.

Repository StudyDate sudah banyak memakai GRANT/REVOKE eksplisit dan safe RPC, tetapi remote advisor belum bisa dijalankan. Jadwalkan preflight sebelum tanggal tersebut.

Referensi resmi:
https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

## 6. Environment readiness

Project study-date memiliki nama environment penting untuk:

- Supabase URL dan publishable key;
- Supabase service-role server-only;
- site URL;
- StudyDate email/Resend/SMTP;
- verification encryption dan HMAC;
- Contact Reveal encryption;
- Event ticket secret;
- Student Verification flags;
- PDDikti provider;
- Telegram bot, webhook, encryption, HMAC, dan cron;
- AutoGoPay.

Audit hanya memeriksa keberadaan nama dan scope tanpa mendekripsi nilai. Keberadaan variable bukan bukti value valid atau fitur aktif.

Project study-date-id tidak menampilkan environment variable pada pemeriksaan ini.

## 7. End-to-end test plan setelah blocker selesai

Gunakan dua akun sintetis terkontrol, A dan B.

1. Early Access A/B disetujui.
2. Magic link/Google login sesuai provider yang benar.
3. PKCE callback dan session cookie.
4. Onboarding atomik.
5. A dan B opt-in discoverability.
6. A menemukan safe projection B.
7. A mengirim perkenalan.
8. B menerima.
9. Chat terbuka tanpa identity/contact leak.
10. A dan B mengirim pesan.
11. One-sided Kenal Lebih Jauh tetap privat.
12. Mutual completion.
13. Identity Reveal dua arah.
14. Contact Reveal per channel.
15. Circle join dan invitation.
16. Event register, ticket, dan check-in.
17. Block/report behavior.
18. Account deletion gate dan cleanup.
19. Verifikasi RLS silang A/B.
20. Cleanup seluruh data sintetis.

Test harus berhenti pada boundary pertama yang rusak dan mencatat bukti aktual.

## 8. Keputusan audit

Production public surface: **berfungsi dan dapat diakses**.

Authenticated product: **belum boleh dinyatakan terverifikasi penuh**.

Alasan utama bukan error publik, tetapi tidak adanya akses audit ke Supabase StudyDate dan belum dilaksanakannya end-to-end test dua akun pada environment production yang benar.

Langkah terdekat:

1. Otorisasi koneksi Supabase ke project StudyDate.
2. Jalankan migration diff dan advisors read-only.
3. Siapkan dua akun sintetis.
4. Jalankan test People → Perkenalan → Chat → Reveal → Safety.
5. Setelah itu lanjut ke Event v2, verification pilot, Telegram, dan keputusan service Rust.
