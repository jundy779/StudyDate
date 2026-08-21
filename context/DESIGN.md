# StudyDate ID — Design Direction

## 1. Brand

- Name: StudyDate ID
- Tagline: MEET • CONNECT • GROW
- Fusion Blue (current `brand.blue` token): `#014FE7`
- Deep Navy: `#0F1B33`
- White: `#FFFFFF`

Gunakan aset resmi. Jangan redraw logo dari screenshot dan jangan mengubah proporsi symbol.

## 2. Visual direction

StudyDate harus terasa modern, editorial, campus-oriented, calm, private, trustworthy, dan social tanpa terlihat seperti
dating app.

Keyword: **editorial campus-tech**.

## 3. Hindari

- generic SaaS template;
- dashboard overload;
- excessive cards;
- exaggerated gradients;
- glassmorphism everywhere;
- fake charts/statistics;
- fake compatibility percentage;
- swipe decks;
- heart-heavy dating UI;
- purple AI aesthetic;
- excessive pills;
- random illustration styles.

## 4. Typography and layout

Gunakan Poppins untuk heading dan Inter untuk body/UI sesuai konfigurasi project saat ini. Pertahankan headline
editorial yang kuat, body copy yang nyaman, eyebrow yang restrained, dan hindari text terlalu kecil atau manual line
breaks berlebihan.

Desktop: generous whitespace, asymmetric editorial grids, first viewport menampilkan primary action.

Mobile: single-column, touch target nyaman, dialog dapat scroll internal, dan tidak horizontal overflow.

## 5. Landing page frozen

Struktur yang telah disetujui:
1. Navbar
2. Hero
3. People, Groups, Events
4. Introduction-before-chat
5. Progressive privacy
6. Groups
7. Campus Events
8. Online-first
9. Offline safety
10. Early Access CTA
11. Footer (tautan publik: `/privacy`, `/terms`, `/community-guidelines`, `/safety`, `/help`)

Halaman legal/bantuan publik memakai shell editorial terpisah (`PublicDocShell`): Poppins heading,
Inter body, `page-shell`, lebar baca ~42rem, tanpa ilustrasi dekoratif. Jangan redesign landing tanpa
approval eksplisit.

## 6. Hero

Approved: large editorial headline, blue emphasis, anonymous profile visual, dua CTA, dan balanced first viewport.

Jangan mendorong konten terlalu jauh dari navbar, mengecilkan headline agresif, atau menyembunyikan CTA di bawah fold.

## 7. Privacy section

Approved: navy background, large white message, anonymous-chat mockup, dan mascot resmi dekat mockup. Mascot
disembunyikan pada mobile kecil dan tidak boleh terlihat seperti icon kecil yang nyasar.

## 8. Offline safety section

Public landing page menggunakan copy ringkas:
- title: “Bertemu di tempat umum”;
- pilih lokasi ramai, terang, mudah diakses, dan masih beroperasi;
- note: lokasi pribadi tidak diperbolehkan.

Jangan tampilkan daftar panjang lokasi terlarang pada landing page.

## 9. Authentication UI

Login harus calm, focused, branded, tidak ramai, dan tidak terlihat seperti generic admin login.

Wajib: email field jelas, loading, resend cooldown, generic error, keyboard support, dan readable success state.

## 10. Onboarding UI

Empat langkah: basic introduction, interests/goals, comfort preferences, consent.

Gunakan progress yang jelas, no romantic pressure, no rigid compatibility scoring, privacy helper dekat sensitive input,
dan jangan meminta data tidak perlu.

Step 1 memakai hierarchy: Nama depan + NIM, Kampus + Program studi, Jenjang + Semester, lalu Kota/Kabupaten. Desktop
dan tablet memakai dua kolom; mobile satu kolom. Kampus, program studi, dan kota memakai searchable combobox dengan
manual fallback. Helper text harus ringkas dan tidak diulang di setiap combobox.

## 11. Authenticated app

`/app` tetap minimal. Boleh menampilkan private greeting, anonymous alias, real verification status, onboarding state,
Student Verification status/action, People yang sudah tersedia, serta Groups/Events sebagai “Segera hadir”.

Jangan tampilkan fake feed, profile, message, event, group, badge, atau metrics.

### People Discovery

People memakai editorial campus directory: heading kuat, filter tenang, whitespace lega, dan profile card yang hanya
merangkum konteks sosial-akademik. Mascot resmi menjadi anonymous avatar; jangan memakai clear human photo, swipe
deck, compatibility score, atau decorative dating language. Empty/loading/error state harus jujur dan tidak membuat
fake user. Detail People memakai CTA nyata `Kirim perkenalan` setelah Introduction Requests v1.

### Introduction Requests

`/app/introductions` memakai tab Masuk/Terkirim, empty state jujur, dan kartu editorial dengan mascot anonim. CTA
`Kirim perkenalan` di detail People membuka dialog aksesibel. Copy memakai bahasa Perkenalan, bukan match/like/swipe.
Setelah diterima, tampilkan handoff ke Pesan dengan CTA `Mulai percakapan`.

### Anonymous Chat

`/app/messages` menampilkan daftar percakapan anonim setelah perkenalan diterima. Detail
`/app/messages/[publicId]` memakai header alias+mascot, privacy note, bubble teks escaped, composer
`Tulis pesan`, serta aksi Akhiri / Blokir / Laporkan. Setelah Mutual Interest, panel
`Buka Identitas` tersedia untuk siapkan nama depan + foto (conversation-scoped) dan
consent terpisah. Setelah Identity Reveal selesai, panel `Bagikan kontak secara bertahap`
menampilkan Telegram / Instagram / LinkedIn secara independen dengan copy tenang
(tanpa “buka semua”, countdown, atau sinyal one-sided). Setelah Identity Reveal atau
saluran Contact Reveal selesai, `Akhiri` mempertahankan akses yang sudah dibuka;
`Blokir` menyembunyikan identitas/kontak/media lawan pada request berikutnya tanpa
mengklaim bahwa konten yang sudah dilihat terhapus. Jangan menampilkan online status,
typing palsu, atau dekorasi dating.

Telegram Companion v1 tampil sebagai kontrol kecil di area privasi Anonymous
Chat, bukan panel hero atau redesign Telegram-blue. State wajib memakai teks:
unavailable, connect, link dibuat, menunggu bot, konfirmasi, connected, switch,
unlink, dan error. Jangan tampilkan username, avatar, ID, metadata Telegram,
atau one-sided reveal. Dialog switch/unlink memakai accessible name,
description, Escape native, focus restore, touch target, dan copy panjang yang
wrap. Settings hanya menunjukkan connected/not connected + disconnect;
aktivasi percakapan tetap di Anonymous Chat.

### Notifications v1

Student navigation mempertahankan struktur global yang sudah ada dan menambahkan
Notifikasi dengan bell serta unread badge nyata. Desktop menyediakan panel ringkas
berisi lima item terbaru dan tautan ke `/app/notifications`; mobile bell langsung
membuka halaman penuh agar header dan drawer tetap usable. Staff shell tidak mendapat
notification UI student.

Halaman Notifikasi memakai daftar editorial tunggal, bukan grid/card dashboard.
Setiap item menampilkan icon kategori, safe title/description, timestamp Indonesia,
status belum dibaca yang juga tersedia sebagai teks screen reader, dan navigasi
keyboard-accessible. State yang wajib: loading skeleton, generic error + retry, empty
state icon tanpa mascot baru, mark one saat item dibuka, mark all, serta load more.

Copy tidak pernah berisi isi pesan, nama orang, kontak, email, NIM, UUID, consent counterpart,
atau sinyal progres satu sisi. Badge visual dibatasi `99+` tanpa mengubah unread count
aktual pada accessible label. Tipe Circle/Event memakai baris yang sama; judul Circle/Event
hanya sebagai headline terikat, bukan kartu baru atau styling premium.

### Study Circle v1 (deployed)

`/app/circles` memakai daftar editorial, bukan dashboard grid atau clone Discord. Header
memperjelas bahwa membership tidak membuka identitas, kontak, atau private conversation.
Filter dibatasi pada nama, topik, dan cakupan; tidak ada popularitas, ranking, match
percentage, member online, atau rekomendasi palsu.

Create form meminta nama, deskripsi, topik, cakupan `StudyDate | kampus yang sama`, dan
batas anggota. Detail memakai hierarchy: header Circle, description, diskusi, daftar
anggota aman, lalu owner controls. Jangan membuat seluruh section menjadi nested cards;
gunakan border, whitespace, dan typographic hierarchy StudyDate.

Diskusi menggunakan satu kolom pesan plain text dengan alias mascot anonim, timestamp
terbaca, empty state jujur, composer bounded, dan penjelasan bahwa ruang ini bukan
Anonymous Chat privat. Member list hanya menampilkan safe People projection. CTA
`Kirim perkenalan` memakai dialog dan eligibility Introduction existing.

Join/leave, report, remove member, edit, dan archive harus keyboard-accessible dengan
focus jelas. Native `details` dapat dipakai untuk tindakan sekunder tanpa modal berlebih.
Tablet mempertahankan rail 88px, desktop sidebar 260px, mobile satu kolom, dan semua
copy panjang wajib wrap tanpa horizontal overflow.

### StudyDate Plus v1

`/app/membership` memakai halaman akun editorial: heading, status paket, tabel perbandingan
kapasitas, serta satu CTA GoPay QRIS hanya ketika offer dan kill switch aktif. Pending
payment menampilkan buka QRIS, status manual, dan cancel tanpa aggressive polling. Jangan
memakai kartu harga SaaS, gradient berlebih, atau estetika VIP dating. Badge Plus tidak tampil di People.
Owner `/owner/memberships` mengikuti shell staff existing.

### Safety Meeting Flow v1

Panel rencana bertemu berada setelah progressive reveal di conversation room. Form memakai
tempat publik, waktu, timezone, dan empat afirmasi keselamatan. Setelah diajukan detail
read-only; perubahan dilakukan dengan cancel lalu proposal baru. Share memakai teks lokal
melalui native share/clipboard tanpa public link, alias, kontak, foto, atau live location.
Pre/post-check memakai own state dan tidak menampilkan emergency-monitoring claim.

### Campus Events v1 (deployed)

`/app/events` memakai daftar editorial acara mendatang dengan filter nama, kategori, dan
cakupan. Jangan memakai poster palsu, ranking, trending, popularity score, scarcity copy,
atau direktori attendee publik. Jumlah peserta harus berasal dari RSVP nyata.

Create form mengutamakan waktu, tempat publik, kapasitas, lalu empat afirmasi keselamatan
yang jelas. Copy utama: “Gunakan tempat publik yang ramai dan masih beroperasi.” Larangan
rumah, kamar kos, apartemen pribadi, dan kamar hotel disampaikan tenang tanpa menjanjikan
keselamatan mutlak. Field tanggal/waktu dan timezone harus memiliki label serta helper
yang terhubung.

Detail memakai hierarchy: title/status, kategori/cakupan, tanggal dan waktu, venue publik,
kapasitas, deskripsi, RSVP, attendee aman bila authorized, organizer projection, lalu
report/organizer controls. Full, cancelled, archived, dan past harus memakai teks selain
warna. Venue/address panjang wajib wrap.

Daftar attendee hanya untuk organizer atau RSVP `going`, memakai mascot anonim dan safe
People projection. CTA `Kirim perkenalan` memakai dialog existing. RSVP, cancel RSVP,
edit, cancel Event, archive, dan report harus keyboard-accessible dengan focus jelas.
Gunakan native `details` untuk tindakan sekunder; konfirmasi destruktif tidak boleh
bergantung pada dialog tanpa focus management.

Mobile satu kolom dengan date/time controls yang dapat dipakai; tablet mempertahankan
rail 88px dan desktop sidebar 260px. Fase Event lanjutan menambahkan diskusi teks,
waitlist, tiket, dan check-in dalam detail Event tanpa map embed, arbitrary links,
poster, fake people, atau visual dating.

### Account & Privacy Controls v1 (DEPLOYED / LIVE-VERIFIED)

`/app/settings` memakai satu halaman dengan section Profil, Privasi, Blokir,
dan Akun. Gunakan heading, divider, whitespace, dan satu kolom baca; jangan
mengubahnya menjadi grid card dashboard. Navigasi anchor dapat scroll
horizontal pada mobile tanpa membuat page overflow.

Profil menjelaskan alias immutable dan safe People projection. Privasi
membedakan data terlihat, privat, serta dibuka melalui consent existing tanpa
menampilkan one-sided state. Block list memakai maskot resmi dan confirmation
dialog aksesibel dengan Escape/focus restore. Delete request memakai dialog
tenang, acknowledgement eksplisit, dan menjelaskan privacy lock langsung serta
penghapusan server-side yang tidak dapat dibatalkan melalui Student UI.
`/account/deletion-pending` hanya menyatakan akun tidak aktif dan penghapusan
sedang diproses; stage, retry count, failure code, dan detail Storage tidak
ditampilkan.

### Student Verification Center

Gunakan utility copy dan struktur tiga langkah: Data akademik, Bukti kepemilikan, Persetujuan. Status:
“Belum terverifikasi”, “Sedang diperiksa”, “Perlu tindakan”, “Terverifikasi”,
“Data belum dapat diverifikasi”, dan “Kedaluwarsa”. Primary action: “Verifikasi Mahasiswa”.

Selalu jelaskan bahwa nama legal dan NIM tidak tampil pada profil publik, verifikasi bersifat opsional, PDDikti match
saja tidak membuktikan kepemilikan, dan badge tidak menjamin perilaku. Gunakan existing app tokens, visible focus,
single-column mobile flow, dan status announcement; jangan membuat admin dashboard publik.

Academic step memakai urutan Nama lengkap sesuai PDDikti, NIM, Kampus/Universitas, Program studi/jurusan, Jenjang,
dan optional Semester. Tampilkan blok “Upload bukti PDDikti” yang tenang dengan selected-file state, format/size hint,
serta privacy note. Bukti PDDikti dan kartu mahasiswa harus terlihat sebagai dua evidence dengan tujuan berbeda.

Lookup extension v1 mempertahankan struktur existing: `Periksa data akademik`,
loading, hasil match/not-found/mismatch/unavailable, lalu ownership atau manual
fallback. Upload screenshot hanya muncul pada fallback manual dan menjelaskan
bahwa screenshot adalah supporting evidence, bukan proof of ownership.
Reviewer membedakan `AUTO LOOKUP MATCH` dan `MANUAL ACADEMIC REVIEW`; primary
manual action adalah `Setujui data akademik`, bukan `Verify user`. Jangan pakai
logo pemerintah/PDDIKTI atau visual KYC.

### Staff shell

`/staff/login` memakai AuthShell StudyDate tetapi jelas sebagai restricted access tanpa self-registration. Owner dan
Admin memakai navigasi terpisah dari student app, dengan role-derived initial render tanpa flash. Owner shell berisi
Overview, Staff, Verification, Moderation placeholder, Audit, dan real System Readiness. Jangan menampilkan fake
analytics, raw SQL, secrets, atau general database controls.

Gunakan istilah UI **Ruang Operasional**, **Tim operasional**, **Akun
mahasiswa**, **Paket & pembayaran**, dan **Riwayat akses**. Admin landing hanya
menampilkan pekerjaan yang diizinkan capability. Daftar akun selalu masked;
detail support memakai safe profile summary dan tidak menyerupai database
inspector.

Verification admin memakai utility-first review layout, identifier suffix pada list, full sensitive claim hanya pada
explicit reviewer detail, generic errors, dan evidence link lima menit. Owner-only staff UI menampilkan UUID suffix dan
status. Penambahan staff memakai email Auth yang sudah ada; server meresolve pengguna, tanpa input UUID mentah.

## 12. Components

Gunakan primitive yang sudah ada di `components/ui/`: button, input, card, checkbox, dropdown menu, dan label.
Early Access memakai dialog aksesibel di `components/marketing/early-access-dialog.tsx`. Gunakan Lucide untuk icon
dan token typography yang ada. Jangan menambah UI library untuk satu komponen.

## 13. Content style

Bahasa Indonesia yang natural, warm, respectful, clear, non-judgmental, dan tidak manipulatif.

Preferred:
- Kirim Perkenalan
- Kenal Lebih Jauh
- Tetap anonim dulu
- Bertemu di tempat umum
- Koneksi yang berarti

Avoid:
- Study Request
- Apply
- Match 98%
- Kamu ditolak
- Coba rayu lagi
- 100% aman
- Bukan dating app

## 14. Accessibility

Semantic heading, label, visible focus, keyboard flow, status announcement, error association, contrast, Escape/focus
restore, reduced motion, touch targets, dan no color-only meaning.

## 15. Responsive checkpoints

Periksa 375px, 768px, 1024px, 1440px, browser zoom, long Indonesian copy, errors, loading, empty states, dialog height,
dan horizontal overflow.
