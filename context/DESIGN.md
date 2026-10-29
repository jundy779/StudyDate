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

## 5. Landing page (revisi 20 Oktober 2026)

Pemilik produk menyetujui perombakan landing agar lebih hidup dan tidak terasa template. Struktur sekarang:
1. Navbar
2. Hero: kertas buku tulis bergaris kotak, headline dengan coretan stabilo, maskot interaktif
3. Tiga pintu (`#people`): orbit Cari Teman, Circle Belajar, Acara Kampus
4. Cara kerja (`#cara-kerja`): tirai privasi, profil contoh yang terbuka bertahap saat digulir
5. Kamu pegang kendali: navy, janji privasi, maskot privasi
6. Circle (`#groups`): kartu indeks miring dengan efek tilt
7. Acara (`#events`): tiket 2.5D di atas Fusion Blue
8. Early Access CTA di atas kertas buku tulis
9. Footer

Halaman legal/bantuan publik memakai shell editorial terpisah (`PublicDocShell`): Poppins heading,
Inter body, `page-shell`, lebar baca ~42rem, tanpa ilustrasi dekoratif.

Motif: kertas buku tulis (belajar) dan gelembung obrolan (kenalan). Tombol utama bergaya stiker: border navy
2px dengan bayangan navy padat. Huruf tulisan tangan (Kalam) hanya untuk celetukan maskot dan catatan kecil,
tidak untuk heading atau isi panjang. Tepi bergelombang (`WaveEdge`) hanya di pergantian warna besar.

## 6. Sistem maskot

Ada dua lapis maskot:
- **Pose badan penuh resmi** (PNG di `public/brand/mascot/`). Resolusi asli pose chat, hello, dan study kecil
  (sekitar 300 px), jadi jangan ditampilkan besar. Pose depan membawa buku paling tajam (`front-cropped.png`).
- **Kepala maskot vektor** (`lib/brand/mascot.ts`, `components/brand/mascot-head.tsx`). Delapan ekspresi:
  senang, girang, kedip, kaget, mikir, penasaran, ngantuk, malu. Logo S di hoodie tidak digambar ulang.

`MascotBuddy` membuat kepala maskot interaktif: mata mengikuti kursor (mouse saja), kedip acak, reaksi saat
dicolek, gelembung `aria-live`, dan tertidur setelah lama diam. Semua gerak berhenti pada
`prefers-reduced-motion`. Maskot tidak boleh dipakai sebagai janji keamanan dan tidak memakai bahasa match
atau jodoh.

Stiker sosmed dibuat dari sumber yang sama: `npm run brand:mascot-stickers` menghasilkan PNG transparan,
versi stiker bertepi putih, dan kotak 1080 px di `public/brand/mascot/expressions/`.

## 6a. Halaman publik lain (revisi 20 Oktober 2026)

Tentang, Acara publik, Insight, dokumen (Keamanan, Bantuan, Privasi, Ketentuan, Pedoman), Masuk, dan 404 memakai
potongan bersama di `components/marketing/brand-ui.tsx`: `PageHero` (kertas buku tulis + celetukan + maskot),
`HandNote`, `WaveEdge`, dan kelas tombol stiker. Dokumen panjang memakai daftar isi menempel di desktop dan
lipatan "Isi halaman" di HP.

Aturan teks yang berlaku di seluruh situs:
- `section-label` tidak lagi huruf kapital dengan jarak huruf lebar. Label kecil ditulis biasa.
- Tidak memakai tanda pisah panjang (em dash) di teks pengguna. Judul tab memakai "Judul | StudyDate ID".
- Halaman kosong memakai `MascotEmptyState` dengan kepala maskot vektor, bukan PNG pose beresolusi rendah.

### Footer, Akses Awal, dan kontak

Footer memakai tepi bergelombang, judul kolom huruf tangan, dan maskot kecil. Ikon media sosial (simple-icons)
hanya tampil untuk tautan yang diisi dan diaktifkan Owner. Dialog Akses Awal memakai tombol stiker dan kepala
maskot, dengan scroll di dalam dialog pada layar pendek.

### Acara: sampul dan cara ikut (21 Oktober 2026)

- `EventCover` menampilkan foto penyelenggara bila ada, dengan gradasi navy dari bawah supaya judul tetap
  terbaca. Tanpa foto, tetap memakai sampul kategori.
- Pilihan "Cara ikut" berupa tiga kartu (Tatap muka, Online, Keduanya). Kartu terpilih memakai gaya stiker
  (border navy dan bayangan padat) dan cincin fokus saat dipilih dengan keyboard.
- Detail acara online menampilkan kotak "Link acara online" bergaya stiker hanya untuk yang berhak.
- Gambar pratinjau per acara: kertas buku tulis di kiri, foto sampul atau stiker maskot di kanan.

### Setelah acara (21 Oktober 2026)

- Rekap memakai kartu stiker (border navy, bayangan padat). Ulasan memakai lima bintang kuning bergaris navy
  dengan label tulisan tangan ("Keren banget"). Bintang adalah radio asli, jadi tetap jalan dengan keyboard.
- Sertifikat di web dan PNG memakai kertas buku tulis, nama dengan sorotan stabilo kuning yang aman untuk
  nama panjang (membungkus, tidak `nowrap`), lencana "Terverifikasi StudyDate", dan kepala maskot girang.
- Tindakan yang tidak bisa diulang (cabut sertifikat oleh penyelenggara, batalkan sertifikat sendiri) selalu
  lewat langkah konfirmasi.

## 7. Gerak dan 3D

Efek 2.5D ringan saja (tilt kartu, kedalaman bayangan), tanpa pustaka 3D, supaya tetap lancar di HP.
Satu momen utama per halaman: coretan stabilo di hero saat dibuka, dan tirai privasi saat digulir.
Hindari fade-in di setiap section.

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
`Tulis pesan`, emoji picker ringan, official mascot sticker picker, serta aksi Akhiri / Blokir / Laporkan.
Emoji tetap text. Sticker tampil tanpa bubble dekoratif berlebihan dan hanya memakai aset mascot resmi; tidak ada user-uploaded
sticker pada v1. Setelah Mutual Interest, panel
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
kapasitas, serta daftar pilihan Plus 7/30/90 hari hanya ketika package dan kill switch
aktif. Jelaskan bahwa pembelian tidak auto-renew dan pembelian lanjutan menambah masa
aktif yang tersisa. Pending
payment menampilkan buka QRIS, status manual, dan cancel tanpa aggressive polling. Jangan
memakai kartu harga SaaS, gradient berlebih, atau estetika VIP dating. Badge Plus tidak tampil di People.
Owner `/owner/memberships` mengikuti shell staff existing dan menampilkan harga/status
ketiga durasi, bukan input durasi bebas atau tier Basic/Pro/Premium.

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

Detail acara resmi publik menyediakan tindakan tenang untuk menyimpan jadwal (`.ics` atau
Google Calendar) dan membagikan tautan. Jika Web Share tidak tersedia, tombol bagikan
menyalin tautan dan mengumumkan hasilnya melalui `aria-live`; jangan menampilkan data peserta.

Daftar attendee hanya untuk organizer atau RSVP `going`, memakai mascot anonim dan safe
People projection. CTA `Kirim perkenalan` memakai dialog existing. RSVP, cancel RSVP,
edit, cancel Event, archive, dan report harus keyboard-accessible dengan focus jelas.
Gunakan native `details` untuk tindakan sekunder; konfirmasi destruktif tidak boleh
bergantung pada dialog tanpa focus management.

Mobile satu kolom dengan date/time controls yang dapat dipakai; tablet mempertahankan
rail 88px dan desktop sidebar 260px. Fase Event lanjutan menambahkan diskusi teks,
waitlist, tiket, dan check-in dalam detail Event tanpa map embed, arbitrary links,
poster, fake people, atau visual dating.

#### Campus Events v2 (repository implementation)

Detail Event membedakan registrasi pending, confirmed, waitlisted, declined, dan
cancelled dengan teks, bukan warna saja. QR peserta tampil sebagai tiket editorial
StudyDate dengan title, alias aman, waktu, venue publik, dan status; raw token tidak
ditampilkan. Attendee directory tidak tampil untuk peserta reguler.

Workspace organizer memakai hierarchy dan divider, bukan grid dashboard berlebihan:
Overview, Registrations, Check-In, Team, dan Settings. Statistik dibatasi pada angka
operasional nyata. Scanner mobile memprioritaskan rear camera, feedback `aria-live`,
touch target besar, pilihan kamera, serta fallback check-in manual. Check-in staff hanya
melihat identity minimum. Official badge restrained dan hanya tampil untuk flag
server-authoritative.

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

### Keputusan di Ruang Operasional (21 Oktober 2026)

- Panel keputusan yang melayang (Tolak, Minta perbaikan) memakai `<details name="...">` yang sama, sehingga
  hanya satu yang bisa terbuka. Dua panel di posisi yang sama tidak boleh terbuka bersamaan, karena alasan
  bisa dicentang di panel yang tertutupi.
- Judul panel menyebut keputusan dan target. Validasi yang mudah (alasan wajib) dicek di tombol dan
  pesannya muncul di dalam panel; server tetap memvalidasi ulang.
- Setelah aksi, redirect membawa anchor ke pesan hasil supaya tidak tersembunyi di atas halaman.
- Panel yang melayang harus bisa ditutup dengan klik di luar panel, tombol Escape, atau tombol "Batal".
  Panel yang dibiarkan terbuka tidak boleh menghalangi tombol di baris lain.
- Antrean Akses Awal dibuka di tab **Perlu dicek** (hanya status menunggu). Pendaftar yang sudah diputuskan
  pindah ke tab sendiri: Menunggu perbaikan, Disetujui belum login, Sudah login, Ditolak, plus tab Semua. Angka
  tiap tab dari `get_early_access_queue_summary`. Baris Menunggu perbaikan menampilkan kapan email perbaikan
  dikirim dan tidak lagi punya tombol "Minta perbaikan". Pendaftar yang sudah memperbaiki kembali ke Perlu dicek
  dengan label "Sudah diperbaiki, cek lagi".
- Tombol yang memicu email atau keputusan menampilkan "Mengirim..." dan terkunci selama proses, supaya tidak
  diklik dua kali. Setelah hasil keluar, panel tertutup dan pesan hasil digulir ke tengah layar.

### Ruang mahasiswa (renovasi tahap 1, 22 Oktober 2026)

- Satu bahasa visual dengan Ruang Operasional: `components/app/ui.tsx` mengekspor ulang potongan dari
  `components/staff/ui.tsx` (`AppPage`, `Panel`, `TodoItem`, `StatusChip`, `Notice`, `EmptyState`, `HelpTip`,
  `appButton`). Tema selalu terang.
- Menu samping dikelompokkan: Mulai di sini, Cari koneksi (Cari Teman, Perkenalan, Pesan), Belajar dan kegiatan
  (Circle, Acara), Akun kamu (Notifikasi, Verifikasi, StudyDate Plus, Privasi, Pengaturan, Bantuan). Menu aktif
  bergaya stiker. Kotak "Tetap anonim dulu" bermaskot di bawah menu.
- Di HP ada bilah menu bawah: Beranda, Cari Teman, Pesan, Acara, Lainnya (membuka laci menu). Bilah ini
  disembunyikan di ruang obrolan dan pemindai QR karena keduanya punya bilah bawah sendiri. Akun sekolah tidak
  melihat menu sosial yang memang tidak tersedia untuknya.
- Beranda berisi "Yang menunggu kamu": ajakan kenalan, pesan baru, ulasan acara, notifikasi, dan ajakan
  verifikasi, semuanya dari angka asli. Kalau kosong, judulnya "Semua beres" dengan ajakan cari teman atau acara.
- Kepala halaman di `/app` memakai celetukan tulisan tangan (`.app-kicker`).
- Tahap 2: Cari Teman, Perkenalan, Pesan, Circle, Pengaturan, Verifikasi, dan StudyDate Plus memakai `AppPage`
  dan `Panel`. Pesan hasil memakai `Notice`, status memakai `StatusChip` (misalnya profil Tampil/Tersembunyi,
  notifikasi Aktif/Mati dengan tombol Nyalakan/Matikan). Pengaturan punya navigasi kapsul yang menempel di atas
  saat digulir. Pilihan durasi Plus tampil sebagai tiga kartu harga asli dari penawaran Owner.
- Tahap 3: Daftar Acara dan Buat acara memakai `AppPage`; alasan belum bisa membuat acara disimpan di `HelpTip`.
  Ruang penyelenggara (`EventManagementShell`) memakai celetukan tulisan tangan, empat kartu angka bergaya stiker
  (Terkonfirmasi, Menunggu, Daftar tunggu, Sudah hadir), dan menu kapsul yang membungkus di HP. Detail acara
  tetap memakai tata letak gaya Luma yang sudah ada.
- Halaman detail acara (mahasiswa dan publik) memakai dua kolom seperti halaman acara pada umumnya: kolom kiri
  berisi poster persegi (`EventCover variant="poster"`, judul tidak diulang di gambar), penyelenggara dengan
  maskot, jumlah peserta dengan bilah isi, Circle terkait, dan tautan laporan/blokir; kolom kanan berisi label
  status, judul besar, ikon kalender (bulan dan tanggal), ikon tempat, kartu Pendaftaran bergaya stiker yang
  memuat semua tombol daftar/batal/kelola/tiket, lalu Tentang acara, rekap, pengumuman, diskusi peserta, dan
  pengingat tempat publik. Di bawah layar lebar urutannya poster, detail, lalu info pendukung; poster dibatasi
  lebar `max-w-md` supaya tidak memenuhi layar tablet.

### Staff shell (renovasi 22 Oktober 2026)

Ruang Operasional memakai identitas StudyDate (Poppins/Inter, biru #014FE7, navy, maskot) dengan pola dashboard
Fusionify UI, selalu tema terang. Semua halaman Owner dan Admin dibangun dari `components/staff/ui.tsx` dan
`components/staff/staff-frame.tsx`:

- **Kerangka**: sidebar 272px di desktop dengan menu dikelompokkan (Mulai di sini, Pendaftar dan akun, Keamanan,
  Kegiatan, Paket, Data dan situs, Tim). Angka di menu diambil dari sistem; merah hanya untuk yang mendesak
  (pendaftar lebih dari 7 hari, laporan). Di HP menu pindah ke tombol "Menu" yang membuka laci; Escape dan klik di
  luar menutupnya. Kotak bantuan dengan maskot menjelaskan peran yang sedang dipakai.
- **Kepala halaman** (`StaffPage`): celetukan tulisan tangan, judul, satu kalimat penjelasan, tombol aksi di kanan,
  garis putus-putus seperti buku tulis.
- **Panel**: panel utama bergaya stiker (garis navy 2px dan bayangan pejal), panel sekunder `quiet` dengan garis
  tipis supaya halaman tidak ramai.
- **Ringkasan** Owner dan Admin berbentuk "Daftar tugas": satu baris per hal yang perlu ditangani, dengan angka asli.
  Kalau semuanya nol, judulnya "Semua beres untuk sekarang". Tidak ada grafik atau angka karangan.
- **Status** selalu ditulis dengan kata di `StatusChip` (go, wait, warn, stop, info, muted); warna hanya pendukung.
- **Pesan hasil** memakai `Notice`; keadaan kosong memakai `EmptyState` dengan maskot dan satu langkah berikutnya;
  istilah yang mungkin asing dijelaskan lewat `HelpTip` ("Apa ini?") yang bisa dibuka.
- **Saringan** memakai `FilterChips` dengan `aria-current`.
- **Tindakan yang menghapus atau mencabut** (hapus nama kampus/jurusan, nonaktifkan Admin, nonaktifkan Plus, cabut
  izin penyelenggara, hapus tanda resmi, batalkan verifikasi) selalu lewat dialog konfirmasi.
- **Hak akses Admin** ditampilkan per tugas: nama tugas, penjelasan awam, status Aktif/Nonaktif, lalu satu tombol
  Aktifkan atau Cabut. Tugas yang otomatis ikut aktif ditandai, bukan diberi tombol.

`/staff/login` memakai AuthShell StudyDate dengan judul "Masuk ke Ruang Operasional", tanpa pendaftaran. Jangan
menampilkan analitik palsu, SQL mentah, rahasia, atau kontrol database umum.

Istilah UI: **Ruang Operasional**, **Tim dan hak akses**, **Akun mahasiswa**, **StudyDate Plus**, **Daftar kampus**,
**Daftar jurusan**, dan **Riwayat akses**. Admin landing hanya menampilkan pekerjaan yang diizinkan capability.
Daftar akun selalu masked; detail support memakai ringkasan profil yang aman dan tidak menyerupai database
inspector.

Verification admin memakai identifier suffix pada list, data sensitif penuh hanya di halaman pemeriksaan satu
pengajuan, pesan error umum, dan tautan bukti lima menit. Owner-only staff UI menampilkan suffix nomor akun dan
status. Penambahan staff memakai email Auth yang sudah ada; server meresolve pengguna, tanpa input UUID mentah.

Early Access memakai **satu moderation queue** yang dirender di `/owner/early-access` dan `/staff/early-access`. Owner selalu dapat review; Staff tanpa `early_access.review` tampil read-only. Action utama: **Approve & kirim email**, **Kirim ulang undangan**, dan **Reject**. Status UI: Menunggu review, Disetujui, Tidak disetujui, Akses diklaim. Copy harus menjelaskan bahwa approval Akses Awal bukan Student/Alumni Verification. Jangan expose UUID, token invitation, atau status Auth internal pada queue.

## 12. Components

Gunakan primitive yang sudah ada di `components/ui/`: button, input, card, checkbox, dropdown menu, dan label.
Early Access memakai dialog aksesibel di `components/marketing/early-access-dialog.tsx`. Gunakan Lucide untuk icon
dan token typography yang ada. Jangan menambah UI library untuk satu komponen.

## 13. Content style

Bahasa Indonesia yang natural, hangat, menghargai pengguna, jelas, tidak menghakimi, dan tidak manipulatif.

Untuk halaman publik, utamakan istilah konkret yang langsung dipahami mahasiswa: **nama asli**, **foto**, **kontak**,
**circle belajar**, **acara kampus**, dan **perkenalan diterima**. Istilah internal seperti `anonymous-first`,
`progressive privacy`, `mutual interest`, atau `social discovery` hanya dipakai di PRD/architecture atau langsung
dijelaskan dengan bahasa sehari-hari.

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
