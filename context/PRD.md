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
- server-side sign-out.

Live Supabase verification tetap merupakan gate terpisah dan tidak boleh dianggap lulus hanya karena implementasi
lokal ada.

## 6. Belum diimplementasikan

Jangan menganggap fitur berikut tersedia:

**Planned:**

- People discovery;
- privacy-safe public profile query;
- introductions;
- anonymous chat;
- mutual interest;
- identity reveal;
- contact reveal;
- Groups;
- Campus Events;

**Future:**

- student document verification;
- Telegram linking;
- moderation dashboard;
- payment/ticketing;
- recommendation algorithm.

UI tidak boleh menampilkan data palsu untuk fitur tersebut.

## 7. Onboarding

### Step 1 — Perkenalan dasar

Data: nama depan, kampus, program studi, semester opsional, kota/wilayah opsional.

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

## 8. Planned — People MVP berikutnya

Privacy-safe discovery hanya boleh menampilkan alias anonim, blurred/approved avatar, campus, program studi, semester,
minat, connection goals, short intro, dan verification badge.

Jangan tampilkan full name, clear photo sebelum reveal, contact, precise location, auth email, atau internal ID.

Primary action: `Kirim Perkenalan`.

## 9. Planned — Introduction MVP

Status: pending, replied, skipped, reported, expired.

Rules:
- satu introduction aktif per pair;
- message dibatasi;
- link/contact difilter;
- skipped tidak dapat dikirim ulang;
- report tersedia dari awal;
- unanswered introduction dapat expired.

## 10. Planned — Anonymous conversation

Chat terbuka hanya setelah introduction dibalas.

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
