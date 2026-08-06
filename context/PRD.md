# StudyDate ID — Product Requirements Document

## 1. Ringkasan produk

StudyDate ID adalah platform koneksi mahasiswa untuk menemukan orang, grup kecil, dan kegiatan kampus. Belajar serta
kehidupan kampus menjadi konteks awal.

Koneksi dapat berkembang menjadi teman belajar, teman baru, networking, kolaborasi, teman dekat, koneksi berarti, atau
hubungan romantis yang tumbuh alami. Tidak ada kewajiban atau jaminan arah romantis.

## 2. Positioning

Headline:
> Temukan seseorang untuk belajar, ngobrol, dan membangun koneksi yang berarti.

Brand statement:
> Mulai dari belajar. Kenal perlahan. Biarkan koneksi menemukan arahnya.

Tagline:
> MEET • CONNECT • GROW

## 3. Pilar produk

### People

Alur utama:
1. Lihat profil anonim.
2. Kirim perkenalan.
3. Penerima membalas.
4. Anonymous Chat terbuka.
5. Kedua pihak dapat memilih “Kenal Lebih Jauh”.
6. Mutual interest membuka Identity Reveal.
7. Kontak dibuka per jenis melalui persetujuan terpisah.
8. Interaksi dapat dilanjutkan online.
9. Pertemuan offline hanya di tempat umum.
10. Arah koneksi ditentukan bersama.

### Groups

Kelompok kecil untuk belajar, ngobrol, networking, dan aktivitas kampus:
- Study Circle;
- Open Table;
- small campus group;
- networking circle;
- women-only, verified-only, atau campus-only option.

Groups dapat menjadi jalur sebelum perkenalan one-on-one.

### Campus Events

Discovery dan registrasi kegiatan kampus seperti seminar, workshop, study gathering, career talk, networking, kompetisi,
volunteering, organisasi, language exchange, seni, dan olahraga.

Visibility: public, unlisted, campus-only, invite-only.

## 4. Prinsip produk

- Privacy first.
- Consent based.
- Slow burn, tanpa random chat atau swipe cepat.
- Online first.
- Offline hanya di tempat umum.
- User selalu dapat berhenti, menolak reveal, mengakhiri percakapan, block, report, dan membatalkan pertemuan.

## 5. Implemented — Current repository scope

Diimplementasikan pada code dan migration repository saat ini:

- public landing page;
- Early Access waitlist;
- passwordless email authentication;
- Supabase PKCE callback;
- protected routes;
- four-step onboarding;
- anonymous public alias;
- privacy preferences;
- consent records;
- minimal authenticated `/app`;
- server-side sign-out;
- People Discovery v1 untuk browse profil anonim, filter, detail berbasis alias, pagination, dan kontrol visibilitas
  milik sendiri;
- Introduction Requests v1 untuk kirim/terima/tolak/batalkan perkenalan privat, fondasi block/report, rate limit
  database, serta handoff `conversation_shells` menuju Anonymous Chat v1 tanpa messaging;
- Anonymous Chat v1 untuk percakapan teks privat setelah perkenalan diterima, daftar `/app/messages`,
  pengiriman pesan anonim, end/block/report, unread nyata, serta polling aman tanpa expose UUID peserta;
- Staff Roles and Admin Shell v1 dengan satu Supabase Auth, role Owner/Admin/Student, staff login terpisah, owner-only
  staff management, verification review shell, dan audit role tersanitasi.
- Student Verification Center dengan pengajuan opsional, email kampus allowlisted, fallback kartu mahasiswa privat,
  status nyata, dan workflow review manual;
- fondasi manual PDDikti review tanpa scraping atau klaim integrasi API resmi.

Live Supabase verification tetap merupakan gate terpisah dan tidak boleh dianggap lulus hanya karena implementasi
lokal ada.

### Staff authorization

Student adalah default bila tidak ada active trusted staff membership. Admin v1 hanya untuk verification review. Owner
mengelola staff dan dapat membuka verification administration. Role dipercaya hanya bila `app_metadata` cocok dengan
row `staff_members` aktif; `user_metadata`, form mahasiswa, URL, dan client storage tidak pernah menjadi sumber role.

Staff dianjurkan memakai akun khusus dan active staff tidak dapat ditemukan di People. Owner pertama hanya dapat
di-bootstrap melalui operasi service/admin manual setelah akun Auth existing ditemukan secara unik; tidak ada public
owner registration.

## 6. Belum diimplementasikan

Jangan menganggap fitur berikut tersedia:

**Planned:**

- mutual interest;
- identity reveal;
- contact reveal;
- Groups;
- Campus Events;

**Future:**

- official PDDikti API adapter, bila endpoint dan otorisasi resmi tersedia;
- Telegram linking;
- moderation dashboard;
- payment/ticketing;
- recommendation algorithm;
- Supabase Realtime delivery untuk chat (v1 memakai authenticated polling RPC).

UI tidak boleh menampilkan data palsu untuk fitur tersebut.

### Student Verification Center

Badge mahasiswa hanya diberikan bila dua syarat terpenuhi:
1. data akademik cocok melalui pemeriksaan manual PDDikti;
2. kepemilikan akun dibuktikan melalui email kampus yang domainnya disetujui atau review kartu mahasiswa.

Status UI: Belum terverifikasi, Sedang diperiksa, Perlu tindakan, Terverifikasi, Data belum dapat diverifikasi, dan
Kedaluwarsa. Verifikasi bersifat opsional dan tidak menjamin perilaku atau keamanan pengguna.

Pengajuan verification mencakup screenshot PDDikti sebagai bukti akademik terpisah dari bukti ownership. Screenshot
disimpan privat, hanya tersedia melalui review access yang terotorisasi, dan mengikuti jadwal penghapusan.

## 7. Onboarding

### Step 1 — Perkenalan dasar

Data berurutan: nama depan, NIM opsional, kampus, program studi, jenjang, semester opsional, dan kota/wilayah
opsional. NIM hanya diproses bila user memilih mengisinya, disimpan terenkripsi di area privat terpisah, dan digunakan
untuk student verification.

Tidak meminta nama lengkap, nomor telepon, alamat, lokasi presisi, social media, atau student ID document.

### Step 2 — Minat dan tujuan

Connection goals:
- study;
- friendship;
- networking;
- collaboration;
- campus_activities;
- meaningful_connection.

Starter interests:
- technology;
- design;
- business;
- languages;
- books;
- film;
- music;
- sports;
- organizations;
- career;
- research;
- volunteering.

### Step 3 — Cara memulai

- online first;
- group first;
- verified users only;
- same campus preferred;
- cross-campus allowed.

### Step 4 — Consent

Consent terpisah: Terms, Privacy, dan Community Guidelines.

Onboarding selesai hanya setelah transaksi database berhasil.

## 8. Implemented — People Discovery v1

Privacy-safe discovery menampilkan alias anonim, mascot/avatar lokal anonim, campus, program studi, semester, wilayah
umum, minat, connection goals, short intro, dan genuine verification badge melalui projection RPC khusus.

Profil hanya muncul bila onboarding selesai dan user memilih `is_discoverable = true`. Current user dikecualikan. Browse
dan detail membutuhkan session authenticated serta onboarding lengkap. Route detail memakai public alias, bukan UUID.

Filter v1: kampus, program studi, semester, kota/kabupaten, connection goal, dan interest. Hasil diurutkan deterministik
berdasarkan public alias dan memakai pagination berbatas.

Jangan tampilkan full name, clear photo sebelum reveal, contact, precise location, auth email, atau internal ID.

Detail People menyediakan CTA `Kirim perkenalan` menuju Introduction Requests v1.

## 9. Implemented — Introduction Requests v1

Mahasiswa onboarded dapat mengirim satu pesan pembuka singkat ke profil anonim yang eligible, melihat Perkenalan
Masuk/Terkirim di `/app/introductions`, lalu menerima, menolak, atau membatalkan.

Status: `pending`, `accepted`, `declined`, `cancelled`, `expired`.

Rules:
- satu introduction pending per pasangan;
- message 12–300 karakter, plain text, filter kontak best-effort;
- cooldown 7 hari setelah decline/cancel untuk pasangan sender→recipient yang sama;
- rate limit: 5/jam, 15/hari, maksimal 5 pending keluar;
- pending kedaluarsa setelah 14 hari;
- active staff tidak dapat mengirim atau menerima;
- block dua arah menutup pending dan mencegah introduction baru;
- report hanya oleh peserta introduction;
- penerimaan tidak membuka identitas, kontak, NIM, atau evidence;
- accepted menciptakan tepat satu `conversation_shells` berstatus `awaiting_chat` sebagai handoff Anonymous Chat v1
  tanpa composer pesan.

## 10. Planned — Anonymous conversation

Chat terbuka hanya setelah introduction diterima dan shell `awaiting_chat` diaktifkan pada tahap berikutnya.

Actions: reply, end, block, report, mutual interest.

Jangan bocorkan Telegram metadata, email, sender ID, atau kontak sebelum reveal.

## 11. Planned — Reveal

Identity Reveal:
- first name;
- clear photo;
- verification status.

Contact Reveal terpisah:
- Telegram;
- Instagram;
- WhatsApp;
- email;
- full name.

Setiap tipe membutuhkan mutual consent terpisah.

## 12. Planned — Groups MVP

Group card: name, type, date/time, online/public location, capacity, host verification, visibility, join request, rules.

Controls: join, leave, report, block organizer, waitlist. Contact peserta tidak publik.

## 13. Planned — Events MVP

Event: title, description, category, organizer, visibility, public location/online link, start/end, capacity,
registration, waitlist, reminder, check-in, report.

Attendee list privat secara default.

## 14. Planned — Safety flows

Landing page memakai pesan positif dan ringkas. Detail safety tersedia pada Safety Center, meeting flow, Community
Guidelines, dan bot reminder.

Meeting flow harus menyediakan public-location confirmation, cancellation, share plan, safety check, dan post-meeting
check. Jangan menjanjikan emergency response.

## 15. Success criteria

Prioritaskan onboarding completion, quality introductions, reply rate, conversation safety, report handling, group
participation, event attendance, user-controlled reveal, low abuse, dan retention yang sehat.

Jangan menampilkan angka target publik yang belum disetujui.
