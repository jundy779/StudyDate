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
- public legal/safety/help pages (`/privacy`, `/terms`, `/community-guidelines`, `/safety`, `/help`);
- Early Access waitlist;
- Early Access Account Claim (waitlist → authenticated email ownership → atomic claim → onboarding prefill terbatas);
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
- Membership & Entitlement Engine v1 (Free default + StudyDate Plus) untuk kuota kapasitas
  server-side tanpa pembayaran, checkout, atau AutoGoPay;
- Introduction Requests v1 untuk kirim/terima/tolak/batalkan perkenalan privat, fondasi block/report, rate limit
  database, serta handoff `conversation_shells` menuju Anonymous Chat v1 tanpa messaging;
- Anonymous Chat v1 untuk percakapan teks privat setelah perkenalan diterima, daftar `/app/messages`,
  pengiriman pesan anonim, end/block/report, unread nyata, serta polling aman tanpa expose UUID peserta;
- Mutual Interest v1 (migration `202608060004`) untuk consent privat
  “Kenal Lebih Jauh” di percakapan aktif, tanpa one-sided leak dan tanpa Identity Reveal otomatis;
- Identity Reveal v1 (migration `202608060005`, applied remotely) untuk consent
  terpisah setelah Mutual Interest: nama depan + foto profil yang disiapkan user, privat
  sampai kedua pihak menyetujui; tanpa Contact Reveal;
- Staff Roles and Admin Shell v1 dengan satu Supabase Auth, role Owner/Admin/Student, staff login terpisah, owner-only
  staff management, verification review shell, dan audit role tersanitasi.
- Student Verification Center dengan pengajuan opsional, email kampus allowlisted, fallback kartu mahasiswa privat,
  status nyata, dan workflow review manual;
- fondasi manual PDDikti review tanpa scraping atau klaim integrasi API resmi.
- PDDIKTI Academic Lookup + Manual Verification Fallback v1 **DATABASE DEPLOYED**:
  adapter pihak ketiga server-only dan replaceable untuk membantu academic
  match exact, dengan fallback screenshot privat. Provider match maupun
  screenshot approval tidak menggantikan ownership proof; Student Verification
  tetap globally disabled, provider tetap disabled, dan controlled rollout belum
  dimulai.

Migration database telah live-verified dengan akun sintetis tanpa memanggil
provider nyata. Status ini tidak berarti Student Verification sudah live.

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

- contact reveal;

**Future:**

- adapter sumber akademik resmi, bila endpoint dan otorisasi resmi tersedia;
- Telegram linking;
- moderation dashboard;
- payment/ticketing dan Billing Phase 2 (AutoGoPay/QRIS/checkout); fondasi paket Free/Plus
  sudah ada tanpa pembayaran;
- recommendation algorithm;
- Supabase Realtime delivery untuk chat (v1 memakai authenticated polling RPC).

UI tidak boleh menampilkan data palsu untuk fitur tersebut.

### Student Verification Center

Badge mahasiswa hanya diberikan bila dua syarat terpenuhi:
1. data akademik cocok melalui pemeriksaan manual PDDikti;
2. kepemilikan akun dibuktikan melalui email kampus yang domainnya disetujui atau review kartu mahasiswa;
3. reviewer aktif memberi persetujuan akhir sebelum badge diterbitkan.

Status UI: Belum terverifikasi, Sedang diperiksa, Perlu tindakan, Terverifikasi, Data belum dapat diverifikasi, dan
Kedaluwarsa. Verifikasi bersifat opsional dan tidak menjamin perilaku atau keamanan pengguna.

Pengajuan verification mencakup screenshot PDDikti sebagai bukti akademik terpisah dari bukti ownership. Screenshot
disimpan privat, hanya tersedia melalui review access yang terotorisasi, dan mengikuti jadwal penghapusan.

Lookup pihak ketiga v1 hanya membantu academic match dan tidak menjadi sumber
profil. Auto-match membutuhkan NIM, nama legal, kampus, dan program exact setelah
normalisasi. `not_found`, mismatch, timeout, dan provider unavailable dapat
masuk manual fallback tanpa membuka candidate lain. Seluruh alur masih terbatas
pada controlled test allowlist selama flag global OFF. Status akademik yang
dikembalikan provider hanya menjadi metadata untuk reviewer, bukan keputusan
otomatis.

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

Filter v1: kampus dan program studi tersedia untuk semua paket. Filter lanjutan
(semester, kota/kabupaten, connection goal, interest) adalah kapasitas StudyDate Plus;
server mengabaikan filter lanjutan untuk paket Free. Hasil diurutkan deterministik
berdasarkan public alias dan memakai pagination berbatas. Kuota People harian dihitung
per pemanggilan `list_people_discovery_profiles` pada jendela UTC, bukan dari UI.

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
- security rate limit tetap 5/jam dan 15/hari untuk semua paket (Plus tidak menembus anti-spam);
- kuota produk pending keluar dan kiriman harian mengikuti paket (Free 3/3, Plus 10/10; angka peluncuran);
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

## 11. Implemented — Identity Reveal v1

Identity Reveal v1 (migration `202608060005`, applied remotely) membuka hanya:
- first name yang disiapkan user secara eksplisit untuk reveal pada percakapan eligible;
- clear profile photo yang diunggah khusus untuk reveal pada percakapan itu.

Profil reveal bersifat conversation-scoped (bukan identitas global reusable). Persiapan
memerlukan Mutual Interest selesai, shell aktif, peserta authenticated non-staff, dan
tidak saling memblokir. Setelah selesai:
- `ended` mempertahankan akses nama depan + foto kedua pihak menurut kebijakan retensi;
- `blocked` menghentikan proyeksi identitas/media lawan pada request berikutnya tanpa
  mengklaim bahwa screenshot sebelumnya terhapus.

Tidak membuka verification badge sebagai klaim “real identity verified”, kontak, nama legal,
NIM, atau evidence. Contact Reveal memerlukan consent per saluran yang terpisah.
Student Verification tetap dinonaktifkan secara global.

## 11b. Implemented — Contact Reveal v1

Contact Reveal v1 (migration `202608060006`, applied remotely) membuka
hanya saluran yang disetujui dua arah setelah Identity Reveal selesai:

- Telegram (username);
- Instagram (username);
- LinkedIn (URL profil publik `/in/...`).

Setiap saluran independen: persiapan dan consent satu pihak tetap privat; tidak ada operasi
“buka semua kontak”. Nilai kontak dienkripsi server-side (AES-256-GCM) dan bersifat
conversation-scoped. WhatsApp, telepon, email, X/Twitter, Discord, Facebook, dan URL
bebas tidak diimplementasikan. Setelah saluran selesai: `ended` mempertahankan akses
kontak yang sudah dibuka; `blocked` menyembunyikan kontak lawan pada request berikutnya
tanpa mengklaim bahwa konten yang sudah dilihat terhapus.

## 11c. Implemented and deployed — Notifications v1

Notifications v1 tersedia melalui migration `202608070013`, diterapkan ke remote setelah
single-migration dry-run, dan lolos live audit A/B/C dengan cleanup sintetis. Notifikasi
in-app hanya dibuat untuk event bermakna yang telah diotorisasi pada tahap produk saat itu:

- perkenalan baru;
- perkenalan diterima;
- pesan Anonymous Chat baru tanpa isi pesan;
- Mutual Interest yang sudah selesai dua arah;
- Identity Reveal yang sudah selesai dua arah;
- Contact Reveal yang sudah selesai dua arah per Telegram, Instagram, atau LinkedIn.

Tidak ada notifikasi untuk decline, report status, aktivitas antrean moderasi, atau
persetujuan satu sisi. Secara khusus, pilihan/withdrawal Mutual Interest satu sisi,
persiapan/consent/withdrawal Identity Reveal satu sisi, dan
persiapan/consent/withdrawal Contact Reveal satu sisi dilarang menghasilkan notifikasi.
Notifications v1 tidak mencakup push, Web Push, email, SMS, WhatsApp, Telegram bot,
presence, typing indicator, atau last seen. Preference per kategori belum ada;
seluruh tipe memakai inbox, badge, dan read-state yang sama.

## 11d. Local-only — Circle & Event Notifications v1

Circle dan Campus Event memakai Notification Center yang sudah ada. Tidak ada inbox
kedua, tidak ada `circle_notifications` / `event_notifications`, dan pengiriman tidak
di-gate oleh StudyDate Free atau Plus. V1 tetap in-app only.

Notifikasi hanya untuk perubahan lifecycle yang benar-benar ada:

- Circle: anggota baru ke owner; nama/topik penting ke anggota aktif; arsip ke
  anggota aktif; pengeluaran anggota hanya ke yang dikeluarkan.
- Event: konfirmasi RSVP ke peserta; perubahan jadwal/lokasi ke RSVP `going`;
  pembatalan Event ke RSVP `going`.

Join Circle bersifat langsung (tanpa approval), jadi permintaan bergabung
tidak berlaku. Konfirmasi join ke pelaku sendiri dihilangkan karena UI sudah
menampilkan status. Pesan grup, leave sukarela, dan penyimpanan deskripsi/typo
tidak men-fan-out notifikasi. Reminder Event ditunda karena tidak ada scheduler
produk yang aman khusus untuk ini (`event_reminders: DEFERRED_NO_SCHEDULER`).

Jadwal dan venue Event tetap terkunci setelah RSVP non-organizer pertama; trigger
perubahan hanya berbunyi jika field material benar-benar berubah. Deep link memakai
slug opaque existing (`/app/circles/circle-…`, `/app/events/event-…`). Record yang
tidak lagi dapat diakses gagal ke `notFound()` halaman existing.

Migration `202608170006_circle_event_notifications_v1.sql` bersifat forward-only
dan belum diterapkan remote pada task ini.

## 12. Implemented and deployed — Study Circle v1

Study Circle v1 tersedia melalui migration `202608090001_create_study_circles_v1.sql`
dan forward fix `202608090002_fix_study_circle_rpc_ambiguity.sql`; keduanya sudah
disinkronkan ke remote setelah preflight terkontrol. Mahasiswa onboarded dapat menemukan
Circle terbuka atau Circle kampus yang sama, membuat Circle, bergabung langsung, keluar,
membaca daftar anggota aman, dan berdiskusi dengan teks biasa.

Membership: `active`, `left`, atau `removed`. Creator menjadi owner Circle; v1 tidak
menambahkan moderator terpisah atau approval workflow. Owner dapat memperbarui metadata,
mengeluarkan anggota, dan mengarsipkan Circle, tetapi tidak mendapat akses staff, Anonymous
Chat, Identity Reveal, Contact Reveal, atau data privat mahasiswa.

Daftar anggota hanya memakai projection setara People: alias anonim, mascot resmi di UI,
kampus, program studi, semester, minat/tujuan, dan badge genuine bila benar-benar verified.
Nama, email, NIM, foto reveal, kontak, UUID, dan state koneksi privat tidak diproyeksikan.

Diskusi hanya dapat dibaca/ditulis anggota aktif, berupa plain text maksimal 800 karakter,
tanpa attachment, rich embed, voice, atau video. Filter kontak best-effort mendorong anggota
memakai Perkenalan dan Contact Reveal. Riwayat grup tetap terlihat bagi anggota aktif ketika
dua anggota saling memblokir, tetapi eligibility Perkenalan tetap mengikuti seluruh aturan
Introduction dan block yang sudah ada.

Circle dan pesan dapat dilaporkan melalui antrean moderasi platform dengan evidence excerpt
maksimal 280 karakter yang terikat pada objek laporan. Arsip mencegah join dan pesan baru
namun mempertahankan riwayat anggota aktif dan evidence moderasi. Membership tidak pernah
membuat conversation, Mutual Interest, Identity Reveal, atau Contact Reveal.

Join, leave, pesan grup, dan browsing Circle tidak men-fan-out ke seluruh anggota.
Notifikasi Circle yang bermakna ditambahkan kemudian melalui Notification Center
existing (lihat 11d), tanpa mengubah model membership.

Live audit sintetis A/B/C/D mengonfirmasi discovery open/campus, membership dan owner
authorization, discussion privacy, report-scoped evidence, Introduction/block integration,
arsip, RLS/grants, tidak adanya side effect ke private connection flow atau Notifications,
safe UI projection, serta cleanup lengkap. Student Verification tetap dinonaktifkan.

Kapasitas Circle aktif yang dibuat/diikuti adalah kuota membership (Free 1/3, Plus 3/10;
angka peluncuran). Downgrade tidak menghapus Circle yang sudah ada; pembuatan/join baru
ditolak sampai pemakaian kembali di bawah batas paket. Security rate limit create 2/hari
dan membership 30/hari tetap berlaku untuk semua paket.

## 13. Implemented and deployed — Campus Events v1

Campus Events v1 tersedia melalui migration
`202608090003_create_campus_events_v1.sql` dan forward fix
`202608090004_fix_campus_event_detail_projection.sql`; keduanya telah diterapkan ke
remote dan post-deploy dry-run kosong. Mahasiswa onboarded dapat menemukan acara
mendatang yang terbuka atau terbatas pada kampus yang sama, membuat acara di tempat
publik, RSVP, membatalkan RSVP, serta melaporkan acara atau organizer melalui Moderation
Triage existing.

Lifecycle Event adalah `scheduled | cancelled | archived`; status selesai diturunkan dari
`end_at` agar tidak memerlukan cron. Waktu disimpan sebagai `timestamptz` dan input lokal
selalu dipasangkan dengan timezone Indonesia yang diizinkan. Venue dibatasi pada kategori
tempat publik dan membutuhkan empat konfirmasi keselamatan yang ditegakkan server.
Filter phrasing lokasi privat bersifat best-effort dan bukan jaminan keselamatan.

RSVP adalah `going | cancelled`, idempotent, dapat diaktifkan kembali setelah pembatalan
sukarela selama Event masih eligible dan memiliki kapasitas. Kapasitas 3–30 ditegakkan
atomik dengan row lock Event sebelum menghitung RSVP aktif. Organizer otomatis terdaftar
sebagai peserta pertama dan tidak dapat membatalkan RSVP organizer.

Waktu, timezone, dan venue dikunci setelah peserta non-organizer pertama memiliki RSVP
`going`. Organizer masih dapat memperbarui metadata non-lokasi serta kapasitas selama
tidak lebih kecil dari jumlah RSVP aktif. Pembatalan Event tidak dapat dipulihkan dan
mempertahankan riwayat. Notifikasi perubahan jadwal/lokasi dan pembatalan memakai
Notification Center existing (lihat 11d) bila field material benar-benar berubah.

Discovery dan detail publik hanya menunjukkan jumlah peserta nyata. Daftar peserta aman
hanya tersedia bagi organizer dan peserta dengan RSVP `going`; pasangan yang saling
memblokir tidak diproyeksikan satu sama lain. Projection hanya memakai data People yang
aman. Attendance tidak pernah membuka nama, foto reveal, kontak, UUID, percakapan privat,
Mutual Interest, Identity Reveal, atau Contact Reveal.

CTA `Kirim perkenalan` memakai seluruh eligibility Introduction existing. Attendance,
browse, RSVP, cancel RSVP, dan edit Event tidak membuat private-flow. Circle association,
event chat, waitlist, ticketing, pembayaran, check-in, dan reminder tetap di luar v1.
Student Verification tetap dinonaktifkan dan bukan syarat penggunaan Event.

Live audit sintetis A/B/C/D mengonfirmasi venue dan batas waktu, open/campus discovery,
RSVP idempotent serta final-slot concurrency, attendee projection aman, block dan
Introduction existing, organizer/staff isolation, report-scoped evidence, schedule/venue
lock, cancel/archive retention, RLS/grants, zero private-flow atau Event Notification
otomatis, authenticated UI smoke, serta cleanup lengkap.

## 13b. Deployed — Account & Privacy Controls v1

`/app/settings` menggabungkan Profil, Privasi, Blokir, dan Akun dalam satu
halaman editorial. Mahasiswa dapat memperbarui kampus/program yang telah
disetujui, jenjang, semester, wilayah umum, intro, minat/tujuan, maskot,
default Contact Reveal privat, dan visibilitas People. Alias anonim tetap
immutable; nama legal/privat, NIM, status staff/verifikasi, snapshot reveal,
ciphertext, dan UUID tidak menjadi field settings.

Daftar blokir hanya menunjukkan safe anonymous projection dari blokir yang
dibuat user saat ini. Unblock tidak memulihkan Introduction, chat, atau reveal.
Discoverability OFF hanya menutup hasil/direct detail People baru dan tidak
menghapus relationship, Circle, Event, atau reveal yang sudah sah.

Permintaan penghapusan bersifat irreversible melalui Student UI serta membuat
privacy lock langsung dan idempotent: profil non-discoverable, akses normal
ditutup, dan shared social mutation ditolak oleh guard database. Worker
server-only menghapus data privat/Storage sebelum Auth, mengarsipkan Circle
milik user, membatalkan Event mendatang, dan mempertahankan shared history
dengan tombstone `Akun dihapus`. Identity/Contact user yang menghapus akun
langsung tidak lagi diproyeksikan.

Bukti moderasi aktif bertahan sampai kasus selesai; bukti resolved/dismissed
dan security audit tersanitasi mengikuti satu kebijakan limited-rollout
maksimum 180 hari. Migrations `202608100001`–`202608100003` telah diterapkan
dan live-verified pada project StudyDate. Student Verification tetap
dinonaktifkan.

## 13c. Local-only — Telegram Anonymous Chat Companion v1

Telegram Companion adalah transport teks opsional untuk satu Anonymous Chat
existing, bukan login, discovery, matching, DM baru, atau Contact Reveal.
Alur link memakai token opaque HMAC-hashed berumur 10 menit:
StudyDate membuat sesi → `/start <token>` di @StudyDateBot hanya menghasilkan
`telegram_pending` → user wajib kembali ke sesi StudyDate dan mengonfirmasi
sebelum binding/relay aktif.

V1 membatasi satu relay percakapan aktif per user. Switch harus dikonfirmasi,
tidak menghapus chat lama, dan tidak memberi sinyal kepada counterpart.
Telegram identity tidak diproyeksikan; binding memakai keyed fingerprint serta
AES-256-GCM route ciphertext dengan key khusus Telegram. Ingress memakai
normalisasi, panjang, rate limit, idempotency, filter kontak, block, lifecycle,
staff, dan deletion gate Anonymous Chat existing. Mutual Interest, Identity
Reveal, dan Contact Reveal tetap web-only. Relay hanya teks; group/media
ditolak.

Outbound memakai outbox durable dan executor server-only dengan lease/retry.
Vercel Cron memanggil protected runner endpoint sekali per menit untuk bounded
batch maksimal 25 delivery. Migration
`202608110001_create_telegram_anonymous_chat_companion_v1.sql` tetap
**LOCAL-ONLY**, kill switch default OFF, BotFather/webhook production belum
dikonfigurasi, dan fitur belum deployed/live.

## 13d. Local-only — Membership & Entitlement Engine v1

StudyDate memakai paket **StudyDate Free** (default) dan **StudyDate Plus**. Free tidak
memerlukan baris entitlement. Plus hanya aktif bila `status = active`, `starts_at <= now()`,
dan (`ends_at` IS NULL atau `ends_at > now()`) menurut waktu database UTC. Kedaluwarsa
berbasis timestamp; cron tidak diperlukan untuk kebenaran resolver.

Kuota Phase 1 adalah konfigurasi peluncuran, bukan kebenaran bisnis permanen:

```text
FREE  peopleDiscoveryDaily 10 | introductionRequestsDaily 3 | activeIntroductions 3
      createdCirclesActive 1 | joinedCirclesActive 3 | advancedDiscoveryFilters false
PLUS  peopleDiscoveryDaily 40 | introductionRequestsDaily 10 | activeIntroductions 10
      createdCirclesActive 3 | joinedCirclesActive 10 | advancedDiscoveryFilters true
```

Tidak berlaku: savedConnections (fitur tidak ada). Ditunda: retensi chat berbayar, kuota
Campus Events. Keamanan (block, report, Safety Center, privasi, consent, Identity/Contact
Reveal, verifikasi, penghapusan akun) tidak boleh di-paywall. Badge Plus publik tidak
ditampilkan di People. Pembayaran/AutoGoPay/QRIS/checkout tidak ada pada Phase 1.
Downgrade tidak menghapus Circle atau perkenalan yang sudah ada.

Owner dapat grant/cabut Plus terbatas (7/30/90 hari) di `/owner/memberships` via email Auth.
Admin tidak mendapat `memberships.manage`. Early Access tidak otomatis memberi Plus.

Hotfix lokal `202608170005` memperbaiki ambiguitas PL/pgSQL `window_start` pada
`consume_membership_quota` tanpa mengubah kuota atau otorisasi. AutoGoPay/QRIS/checkout
tetap di luar Phase 1.

## 14. Planned — Safety flows

Landing page memakai pesan positif dan ringkas. Detail safety tersedia pada **Pusat Keamanan publik**
(`/safety`), meeting flow (masih planned), Community Guidelines (`/community-guidelines`), dan bot reminder
(planned).

Halaman publik legal/bantuan yang diimplementasikan: `/privacy`, `/terms`, `/community-guidelines`, `/safety`,
`/help` (lihat `docs/operations/public-legal-pages.md`). Google OAuth belum aktif.

Meeting flow harus menyediakan public-location confirmation, cancellation, share plan, safety check, dan post-meeting
check. Jangan menjanjikan emergency response.

## 15. Success criteria

Prioritaskan onboarding completion, quality introductions, reply rate, conversation safety, report handling, group
participation, event attendance, user-controlled reveal, low abuse, dan retention yang sehat.

Jangan menampilkan angka target publik yang belum disetujui.


- Authorized Staff Operations v1: Early Access waitlist ops, safe user account ops, staff assign by email + capability grants (Owner-managed).
