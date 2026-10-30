# StudyDate ID — Master Context for Claude

Dokumen ini adalah handoff utama agar Claude memahami StudyDate ID sebagai produk, brand, sistem, dan repository. Baca dokumen ini sebelum membuat rencana, menulis copy, mengubah desain, mengedit kode, mengubah database, atau menyatakan status fitur.

Diperbarui: 21 Oktober 2026 (tabel status, route, dan akses akun; bagian lain dari 9 Oktober 2026)  
Repository: https://github.com/jundy779/StudyDate  
Production domain: https://studydate.id  
Branch utama: main  
Snapshot yang diperiksa saat dokumen ini disusun: 2629228f7576a2dc68d49131032d7ebcb14dd489

Dokumen ini adalah peta lengkap, bukan pengganti pemeriksaan kode. Fitur dan status dapat berubah setelah tanggal di atas.

---

## 1. Aturan pertama untuk Claude

1. Baca [AGENTS.md](./AGENTS.md) lebih dulu. Project memakai Next.js 16.3.0 dengan perubahan yang mungkin berbeda dari pengetahuan model. Sebelum mengubah kode Next.js, baca dokumentasi versi terpasang di node_modules/next/dist/docs.
2. Jangan menebak struktur file, route, migration, tabel, RPC, atau status production.
3. Untuk klaim teknis, periksa kode, tests, migration, dan environment yang relevan.
4. Jangan menyebut fitur “live”, “aman”, “selesai”, atau “100%” hanya karena UI, migration, environment variable, atau feature flag tersedia.
5. Jangan membuat data palsu, pengguna palsu, acara palsu, angka pertumbuhan palsu, badge palsu, testimoni palsu, atau klaim keamanan mutlak.
6. Jangan mengubah positioning menjadi aplikasi kencan. Hubungan romantis boleh terjadi sebagai hasil opsional, tetapi bukan janji utama produk.
7. Jangan membuka identitas, kontak, NIM, email, UUID, token, storage path, evidence, atau consent satu sisi melalui UI atau API.
8. Gunakan bahasa Indonesia yang sederhana, hangat, dan mudah dipahami mahasiswa. Istilah teknis internal tidak boleh bocor ke pengguna.
9. Keamanan, privasi, blokir, laporan, consent, dan penghapusan akun tidak boleh menjadi fitur berbayar.
10. Perubahan database harus forward-only. Jangan mengedit migration yang mungkin sudah diterapkan.
11. Jangan menjalankan migration remote, bootstrap Owner, webhook production, smoke test provider nyata, rotasi secret, atau tindakan destruktif tanpa izin eksplisit dan verifikasi target.
12. Jika dokumen berbeda dengan kode atau migration terbaru, implementasi aktual menang. Jelaskan drift tersebut dan perbarui dokumen yang relevan.

### Istilah status wajib

Gunakan hanya istilah berikut saat melaporkan status:

| Status | Arti |
|---|---|
| **Remote rollout verified** | Capability sudah diterapkan dan benar-benar diuji pada environment tujuan. |
| **Repository implemented** | Kode, UI, test, atau migration tersedia di repository, tetapi status remote belum terbukti. |
| **Local/device only** | Fitur bekerja di browser/perangkat lokal dan belum disinkronkan ke akun/server. |
| **Planned** | Sudah menjadi arah produk atau roadmap, tetapi belum tersedia. |
| **Not implemented** | Capability belum ada. |
| **Disabled** | Implementasi mungkin ada, tetapi feature flag atau kill switch masih OFF. |

Keberadaan route, schema, feature flag, atau environment variable bukan bukti remote rollout.

---

## 2. Definisi singkat produk

**StudyDate ID adalah ekosistem koneksi untuk mahasiswa dan alumni Indonesia yang membantu orang menemukan teman belajar, kenalan baru, rekan proyek, circle, dan acara kampus melalui kesamaan minat atau aktivitas.**

Pengguna dapat mulai berkenalan secara anonim. Nama asli, foto jelas, dan kontak tidak langsung dibagikan. Koneksi dilanjutkan secara bertahap hanya ketika kedua pihak sama-sama nyaman.

Kalimat publik yang aman:

> Cari teman belajar, kenalan baru, circle, dan acara kampus. Mulai pelan-pelan tanpa langsung membagikan nama asli atau kontak.

Janji sederhana:

> Ketemu lewat hal yang sama. Lanjut kalau sama-sama nyaman.

Positioning headline:

> Temukan teman belajar dan koneksi baru dari lingkungan kampus.

Brand statement:

> Mulai dari kesamaan di kampus. Kenalan tanpa perlu terburu-buru.

Tagline produk pada PRD:

> TEMUKAN • KENALAN • TERHUBUNG

Tagline merek pada design system:

> MEET • CONNECT • GROW

Kedua tagline ada di dokumentasi. Jangan mengganti salah satunya secara sepihak. Gunakan tagline Indonesia untuk penjelasan produk dan tagline Inggris sebagai lockup/brand line bila sesuai desain.

---

## 3. Masalah yang diselesaikan

Mahasiswa dan alumni sering mengalami hal berikut:

- ingin menambah teman atau relasi tetapi tidak tahu harus mulai dari mana;
- ingin belajar, berdiskusi, mengerjakan proyek, atau datang ke acara bersama orang yang relevan;
- informasi circle dan acara tersebar di banyak kanal;
- khawatir harus langsung membagikan nama, foto, kontak, atau data pribadi;
- aplikasi perkenalan umum terlalu menekankan penampilan, swipe, atau hubungan romantis;
- platform acara sering berhenti setelah pendaftaran dan tidak membangun koneksi yang berkelanjutan;
- direktori kampus dapat terlalu terbuka dan tidak memberi kendali kepada pemilik data.

StudyDate ID memulai koneksi dari konteks yang nyata: kampus, program studi, minat, tujuan, Circle, atau Acara. Setelah itu, pengguna menentukan sendiri apakah koneksi menjadi teman belajar, rekan kolaborasi, jaringan profesional, sahabat, atau hubungan personal.

---

## 4. Visi, fokus pasar, dan arah nasional

### Pengguna awal

- Mahasiswa aktif di Indonesia.
- Mahasiswa lintas kampus yang ingin belajar, berdiskusi, mengikuti kegiatan, berorganisasi, mengerjakan proyek, atau memperluas relasi.
- Pengguna yang nyaman memulai perkenalan secara anonim dan bertahap.

### Pengguna tahap berikutnya

- Alumni untuk mentoring, networking, berbagi pengalaman, kolaborasi, komunitas, dan hubungan lintas angkatan.
- Penyelenggara acara kampus.
- Kampus dan mitra komunitas.
- Tim operasional StudyDate ID.

Status mahasiswa dan alumni harus jelas agar konteks perkenalan tidak menyesatkan.

### Arah jangka panjang

StudyDate ID dirancang sebagai jaringan koneksi kampus berskala nasional. Produk ini bukan proyek untuk satu kampus, bukan sekadar proyek pribadi, dan bukan aplikasi kencan generik.

Distribusi jangka panjang:

- Web untuk publik, mahasiswa, penyelenggara, Admin, dan Owner.
- Bot Telegram sebagai pendamping cepat untuk fungsi yang telah diizinkan.
- Aplikasi Android dan iOS untuk penggunaan harian.
- Satu akun, satu sumber data, dan aturan privasi yang sama di semua kanal.

### Pembanding pasar

- Matchu.id dan Setara.fyi adalah pembanding pada area perkenalan/koneksi.
- Luma adalah benchmark pengalaman penemuan, publikasi, pendaftaran, pengelolaan, tiket, dan check-in acara.
- StudyDate ID tidak boleh menyalin identitas visual atau produk mereka secara mentah.
- Pembeda StudyDate ID adalah satu ekosistem yang menghubungkan **People, Circle, dan Acara** dengan alur privasi bertahap.

---

## 5. Apa yang StudyDate ID bukan

StudyDate ID bukan:

- aplikasi dating yang menjanjikan pasangan;
- aplikasi swipe atau penilaian berdasarkan penampilan;
- random chat;
- direktori mahasiswa yang membuka identitas dan kontak;
- aplikasi acara yang berhenti setelah RSVP;
- media sosial umum tanpa konteks;
- platform “AI matching” dengan skor kecocokan palsu;
- sistem verifikasi yang menjamin perilaku baik atau keamanan seseorang;
- layanan darurat, pelacak lokasi, atau penjamin keamanan pertemuan offline.

Hubungan romantis tidak dilarang. Ia boleh tumbuh alami ketika pengguna memilihnya sendiri, tetapi tidak boleh menjadi headline, gaya visual, tekanan interaksi, atau janji hasil.

---

## 6. Pilar produk

### 6.1 People — Cari Teman

People membantu pengguna menemukan profil anonim berdasarkan konteks yang aman:

- nama samaran;
- maskot/avatar lokal anonim;
- kampus;
- program studi;
- semester bila ada;
- wilayah umum;
- minat;
- tujuan koneksi;
- perkenalan singkat;
- badge verifikasi hanya bila genuine.

Alur inti:

1. Pengguna melihat profil anonim.
2. Pengguna mengirim pesan perkenalan.
3. Penerima menerima, menolak, atau mengabaikannya.
4. Jika diterima, Anonymous Chat terbuka.
5. Kedua pihak dapat memilih **Kenal Lebih Jauh**.
6. Setelah pilihan dua arah selesai, mereka dapat menjalankan **Buka Identitas**.
7. Setelah identitas terbuka, tiap kanal kontak dibuka melalui persetujuan terpisah.
8. Jika ingin bertemu, keduanya membuat rencana di tempat umum.
9. Arah koneksi ditentukan bersama.

### 6.2 Study Circle

Circle adalah kelompok kecil untuk:

- belajar bersama;
- diskusi;
- tugas atau skripsi;
- persiapan ujian;
- bahasa;
- teknologi;
- desain;
- bisnis;
- riset;
- organisasi;
- karier;
- proyek atau kompetisi;
- networking dan komunitas.

Circle dapat terbuka atau terbatas satu kampus. Circle memberi alasan untuk kembali ke produk tanpa harus terus-menerus mencari kenalan one-on-one.

### 6.3 Acara Kampus

Acara mendukung penemuan dan keikutsertaan kegiatan seperti:

- belajar bareng;
- seminar;
- workshop;
- diskusi;
- komunitas;
- networking;
- career talk;
- meetup;
- hackathon;
- kompetisi;
- volunteering;
- organisasi;
- language exchange;
- seni;
- olahraga;
- kategori lain yang tetap sesuai kebijakan.

Visibility produk mencakup public, unlisted, campus-only, dan invite-only pada arah Event lanjutan. Pertemuan yang diadakan melalui StudyDate harus memakai tempat publik; lokasi pribadi tidak diperbolehkan.

---

## 7. Nilai utama produk

Urutan nilai StudyDate ID:

1. **Ketemu lewat kesamaan.** Orang memahami alasan mereka bertemu.
2. **Ada alasan untuk kembali.** Circle dan Acara tetap berguna ketika pengguna tidak mencari kenalan baru.
3. **Pengguna memegang kendali.** Nama, foto, identitas, dan kontak tidak dibuka sepihak.
4. **Bisa dipakai di banyak kanal.** Web, Telegram, dan mobile memakai aturan yang sama.
5. **Aman untuk bertumbuh.** Blokir, laporan, moderasi, verifikasi, dan penghapusan akun adalah bagian inti.
6. **Dating bersifat opsional.** Kedekatan boleh muncul, tetapi produk tidak mendorong atau menjanjikannya.

Saringan prioritas fitur:

- Apakah membantu orang bertemu lewat kesamaan?
- Apakah memperkuat hubungan antara People, Circle, dan Acara?
- Apakah pengguna tetap mengendalikan identitas dan kontak?
- Apakah alurnya dipahami tanpa istilah teknis?
- Apakah aman dan masuk akal untuk skala nasional?

Jika sebagian besar jawabannya tidak, fitur tersebut bukan prioritas utama.

---

## 8. Brand, desain, dan bahasa

### Identitas visual

- Nama: StudyDate ID
- Fusion Blue: #014FE7
- Deep Navy: #0F1B33
- White: #FFFFFF
- Heading: Poppins
- Body dan UI: Inter
- Arah visual: **editorial campus-tech**
- Karakter: modern, percaya diri, hangat, tenang, privat, dapat dipercaya, sosial, dan berorientasi kampus.

Gunakan aset logo resmi. Jangan menggambar ulang logo dari screenshot dan jangan mengubah proporsi simbol.

### Hindari

- template SaaS generik;
- dashboard yang terlalu padat;
- terlalu banyak kartu dan pill;
- glassmorphism di semua tempat;
- gradient berlebihan;
- chart atau statistik palsu;
- skor kecocokan palsu;
- swipe deck;
- ikon hati dan bahasa dating yang dominan;
- estetika AI ungu generik;
- gaya ilustrasi acak;
- bahasa kaku seperti dokumen pemerintahan;
- campuran bahasa Inggris yang tidak perlu.

### Gaya copy

Bahasa harus terdengar seperti teman yang membantu, tetapi tetap rapi untuk kampus, mitra, dan investor.

Gunakan:

- Cari teman
- Kirim perkenalan
- Mulai ngobrol
- Kenal lebih jauh
- Buka identitas
- Bagikan kontak
- Gabung Circle
- Ikuti acara
- Ajak
- Lihat Circle
- Lihat acara
- Ruang Operasional
- Bertemu di tempat umum
- Tetap anonim dulu

Hindari bahasa pengguna seperti:

- people discovery;
- progressive reveal;
- mutual interest;
- projection;
- entitlement;
- conversation shell;
- provider adapter;
- repository scope;
- lifecycle mutation;
- actor UUID.

Terjemahkan manfaat lebih dulu. Contoh: bukan “mutual interest selesai”, tetapi “Kalian sama-sama ingin kenal lebih jauh”.

### Nada menurut audiens

- **Mahasiswa/alumni:** santai, ramah, konkret, tidak genit, tidak menggurui.
- **Organizer:** langsung, operasional, jelas soal kapasitas dan peserta.
- **Kampus/mitra:** komunitas, partisipasi, keselamatan, moderasi, dan tata kelola.
- **Investor:** ekosistem nasional, loop People–Circle–Acara, distribusi web–Telegram–mobile, dan pertumbuhan yang tidak mengorbankan keamanan.
- **Admin/Owner:** bahasa kerja langsung seperti “Periksa pengajuan”, “Atur tim”, dan “Tangani laporan”.

### Responsive dan accessibility

- Mobile satu kolom.
- Tidak boleh ada horizontal overflow pada 375px.
- Uji setidaknya 375px, 768px, 1024px, dan 1440px.
- Teks Indonesia panjang harus wrap dengan baik.
- Touch target nyaman.
- Dialog memiliki internal scrolling.
- Gunakan semantic HTML, visible focus, keyboard flow, accessible name, aria-live untuk hasil tindakan, kontras cukup, dan reduced motion.
- Sediakan state loading, empty, error, retry, disabled, dan success yang jujur.

---

## 9. Peran pengguna dan batas akses

### Publik

Dapat mengakses:

- landing page;
- halaman Tentang;
- Acara publik;
- Insight;
- Privacy;
- Terms;
- Community Guidelines;
- Safety;
- Help;
- Early Access;
- login.

Publik tidak boleh melihat daftar peserta privat, data mahasiswa, kontak, atau data operasional.

### Mahasiswa/alumni

Setelah login dan onboarding:

- mengatur profil belajar dan privasi;
- menemukan People;
- mengirim dan menangani perkenalan;
- menggunakan Anonymous Chat;
- memakai consent bertahap;
- bergabung/membuat Circle sesuai kuota;
- menemukan/mendaftar/mengelola Acara sesuai hak;
- mengatur akun dan penghapusan;
- mengakses StudyDate Free/Plus sesuai entitlement.

### Organizer dan tim Acara

Organizer adalah pengguna biasa dengan kewenangan terbatas pada Event yang dikelola. Dalam Event v2 terdapat cohost dan petugas check-in dengan scope per Event. Status Plus tidak otomatis memberi trust atau kewenangan moderasi.

### Admin

Admin memakai akun staff khusus dan hanya mendapat capability eksplisit. Admin tidak otomatis menjadi Owner. UI staff menggunakan istilah **Ruang Operasional**.

Tampilan Ruang Operasional dibangun dari `components/staff/ui.tsx` dan `components/staff/staff-frame.tsx` (renovasi 22 Oktober 2026, repository implemented). Halaman staff baru wajib memakai potongan ini: `StaffPage` untuk kepala halaman, `Panel` untuk isi, `StatusChip` untuk status berupa kata, `Notice` untuk pesan hasil, `EmptyState` untuk daftar kosong, `HelpTip` untuk istilah asing, dan dialog konfirmasi untuk tindakan yang menghapus atau mencabut. Ruang mahasiswa memakai potongan yang sama lewat `components/app/ui.tsx` (`AppPage`, `appButton`, dan seterusnya). Tema selalu terang. Bahasa awam, tanpa angka contoh. Antrean Akses Awal dibuka di tab Perlu dicek; yang sudah diputuskan pindah ke tab statusnya.

Capability dapat meliputi:

- membaca/review Early Access;
- melihat akun dukungan secara aman;
- review verifikasi;
- akses operasional tertentu.

Email ditampilkan tersamarkan. NIM, nama legal, kontak, chat, foto reveal, dan evidence tidak boleh diproyeksikan tanpa capability khusus yang memang dirancang.

### Owner

Owner mengelola:

- staff dan capability;
- Early Access;
- moderasi;
- kampus;
- program studi;
- membership;
- operasi Event tertentu;
- audit dan kontrol platform.

Owner pertama tidak memiliki public signup. Bootstrap dilakukan secara manual memakai operasi server terpercaya setelah target diverifikasi.

### Sumber role yang sah

Role dipercaya hanya dari kombinasi Supabase Auth app_metadata yang tepercaya dan row staff_members aktif. Jangan pernah memberi role berdasarkan user_metadata, URL, body form, localStorage, atau hanya karena menu terlihat.

---

## 10. Alur end-to-end pengguna

### 10.1 Early Access dan autentikasi

1. Pengguna mengirim form Akses Awal.
2. Owner atau Staff yang memiliki capability meninjau.
3. Hasil dapat waiting, needs_revision, approved, rejected, atau claimed.
4. Approval mengirim undangan login sekali pakai dengan brand StudyDate.
5. Pengguna membuka magic link.
6. Callback PKCE membuat session cookie.
7. Akun baru harus memiliki klaim Early Access dengan email yang sama.
8. Pengguna yang belum onboarding diarahkan ke onboarding.
9. Pengguna yang sudah onboarding masuk ke /app.

Endpoint login publik harus enumeration-safe. Jangan mengungkap apakah email tertentu terdaftar.

### 10.2 Onboarding empat langkah

1. **Perkenalan dasar:** nama depan, NIM opsional, kampus, program studi, jenjang, semester opsional, wilayah umum opsional.
2. **Minat dan tujuan:** study, friendship, networking, collaboration, campus activities, meaningful connection, serta minat awal.
3. **Cara memulai:** online first, group first, verified users only, same campus preferred, atau cross-campus allowed.
4. **Persetujuan:** Terms, Privacy, dan Community Guidelines secara terpisah.

Alias publik berbentuk Partner #NNNNNN dan dibuat server-side. NIM berada di area privat, tidak di profil publik. Onboarding selesai hanya setelah transaksi atomik berhasil.

### 10.3 People ke Chat

1. Browse People anonim.
2. Filter dasar tersedia untuk Free; filter lanjutan mengikuti Plus.
3. Kirim perkenalan 12–300 karakter.
4. Penerima menerima/menolak; pengirim dapat membatalkan.
5. Accepted membuat satu conversation shell tanpa membuka identitas.
6. Pesan pertama mengaktifkan chat.
7. Pengguna dapat end, block, report, atau memilih Kenal Lebih Jauh.

### 10.4 Consent bertahap

Urutan privasi wajib:

1. Accept perkenalan membuka chat, bukan identitas.
2. Kenal Lebih Jauh satu sisi tetap privat.
3. Mutual completion tidak otomatis membuka identitas.
4. Identity Reveal membutuhkan consent dua pihak terpisah.
5. Identity Reveal hanya membuka nama depan dan foto yang disiapkan untuk percakapan tersebut.
6. Contact Reveal baru tersedia setelah Identity Reveal.
7. Telegram, Instagram, dan LinkedIn dibuka satu per satu melalui consent dua pihak.
8. Tidak ada “buka semua kontak”.
9. Block menghentikan proyeksi data lawan pada request berikutnya, tetapi produk tidak boleh mengklaim screenshot lama terhapus.

### 10.5 Circle dan Acara ke koneksi pribadi

Keanggotaan Circle atau kehadiran Acara tidak otomatis membuat chat privat, mengungkap identitas, atau membagikan kontak. Pengguna tetap memakai **Kirim perkenalan** dan seluruh aturan eligibility yang sama.

Dalam chat, pengguna dapat mengirim kartu ajakan Circle atau Acara yang memang sedang diikuti/dikelola. Penerima tetap harus membuka detail dan bergabung/mendaftar sendiri.

---

## 11. Matriks status fitur per 9 Oktober 2026

Tabel ini adalah snapshot dokumentasi dan repository. Untuk status remote terbaru, periksa migration history, environment, dan live audit.

| Area | Status | Catatan |
|---|---|---|
| Landing dan halaman publik | **Repository implemented** dan digunakan pada domain production | Termasuk about, privacy, terms, guidelines, safety, help, insight, dan Acara publik. |
| Early Access dasar | **Repository implemented** | Insert waitlist, duplicate handling, consent, honeypot, dan rate limit. |
| Early Access moderation/invitation/revision | **Repository implemented** | Migration 202608250002 dan 202608260001 perlu remote verification sebelum disebut aktif penuh. |
| Antrean Akses Awal: ringkasan, urutan, lencana email, pengingat | **Remote rollout verified** | Migration 202610210005 terpasang; ringkasan antrean tampil di production (21 Okt 2026). Tab per status (22 Okt) repository implemented. |
| Akses Awal: setujui banyak sekaligus dan tanda pendaftar ganda | **Repository implemented** | Kotak centang di tab Perlu dicek, maksimal 20 per proses, konfirmasi dulu, diproses satu per satu; yang sudah diundang dilewati. Tanda "Mungkin pendaftar ganda" dari migration 202610300001 (`early_access_identity_key`: huruf kecil, tanpa +tag, tanpa titik Gmail, salah ketik domain umum). Hanya petunjuk; tanpa migration tanda tidak muncul dan halaman tetap jalan. |
| Katalog kampus: Universitas Jember, Universitas Sebelas Maret, Universitas Diponegoro | **Remote rollout verified** | Migration 202610220001 terpasang di production 22 Okt 2026 (db push sukses). |
| Tampilan ruang mahasiswa tahap 1 | **Repository implemented** (push 23 Okt) | Menu samping berkelompok, bilah menu bawah di HP, Beranda berisi "Yang menunggu kamu" dari angka asli, kepala halaman bertulisan tangan (`.app-kicker`), Notifikasi dan Privasi memakai `AppPage`. |
| Tampilan ruang mahasiswa tahap 2 | **Repository implemented** | Cari Teman, Perkenalan, Pesan, Circle, Pengaturan, Verifikasi, dan StudyDate Plus memakai `AppPage`, `Panel`, `Notice`, `StatusChip`. Data Cari Teman dimuat paralel. |
| Tampilan ruang mahasiswa tahap 3 | **Repository implemented** | Daftar Acara, Buat acara, dan Ruang penyelenggara (kartu angka stiker, menu kapsul) memakai gaya baru; detail Circle dan profil orang lain memakai `Notice` dan tombol kembali baru. Perbaikan: tombol menu ganda di HP benar-benar disembunyikan saat bilah bawah tampil. Halaman detail acara mempertahankan tata letak gaya Luma. |
| Halaman detail acara dua kolom | **Repository implemented** | `/app/events/[slug]` dan `/events/[slug]`: poster persegi, penyelenggara, peserta, dan laporan di kiri; judul, ikon kalender, tempat, kartu Pendaftaran, dan Tentang acara di kanan. Di HP berurutan: poster, detail, lalu info pendukung. Belum diuji dengan data acara asli. |
| Kecepatan pindah menu | **Remote rollout verified** (region) | Kerangka loading instan di /owner, /admin, /staff, /app; angka menu staff menyusul; user Auth dicache per request. Supabase di Singapore; function Vercel dipindah ke `sin1` lewat `vercel.json` (22 Okt 2026), cek `x-vercel-id` setelah deploy. |
| Email magic link + PKCE | **Repository implemented** | Delivery nyata dan callback perlu environment test. |
| Onboarding empat langkah | **Repository implemented** | Atomic RPC dan privacy fields tersedia. |
| People Discovery v1 | **Repository implemented** | Safe projection, filter, pagination, discoverability. |
| Status sosial 24 jam | **Repository implemented** | Migration 202610020003; remote rollout belum terverifikasi. |
| Perkenalan | **Repository implemented** | Pending/accepted/declined/cancelled/expired, cooldown, quota, rate limit. |
| Anonymous Chat dasar | **Repository implemented** | Pesan teks/emoji, official sticker, unread, end/block/report. |
| Pencarian chat dan percakapan | **Repository implemented** | Mencari nama samaran, kampus, prodi, dan isi pesan yang sudah dimuat. |
| Draf lokal, salin, menu tindakan | **Repository implemented / Local/device only untuk draf** | Draf per percakapan maksimal 7 hari dan tidak sinkron antarperangkat. |
| Balasan dan reaksi pesan | **Repository implemented** | Migration 202610020004; UI capability-aware, remote rollout belum terverifikasi. |
| Realtime dan typing signal | **Repository implemented** | Migration 202610020002; polling tetap fallback, remote rollout belum terverifikasi. |
| Kenal Lebih Jauh | **Remote rollout verified menurut PRD** | Consent satu sisi tidak bocor. |
| Identity Reveal | **Remote rollout verified menurut PRD** | Nama depan + foto conversation-scoped. |
| Contact Reveal | **Remote rollout verified menurut PRD** | Telegram, Instagram, LinkedIn per channel; encrypted server-side. |
| Notifications inti | **Remote rollout verified menurut PRD** | In-app only; tidak memuat isi pesan atau data privat. |
| Circle notifications / Event notifications | **Status dokumen berbeda** | SCHEMA menyebut migration 202608170006 deployed, PRD section 11d masih menyebut belum remote. Wajib verifikasi migration remote. |
| Study Circle v1 | **Remote rollout verified menurut PRD** | Discovery, join, owner controls, member discussion, report. |
| Campus Events v1 | **Remote rollout verified menurut PRD** | Public venue, RSVP, capacity, attendee projection aman. |
| Event enhancement 202608210003–010 | **SCHEMA mencatat deployed** | Kuota, reminder schema, preferences, Circle association, waitlist, chat, ticket/check-in. Cron reminder masih OFF. |
| Event organizer registration/check-in v2 | **Repository implemented** | Migration 202608220002–003 perlu remote verification. |
| Public Event pages | **Repository implemented** | Share, .ics, Google Calendar, tanpa membuka peserta. Gambar pratinjau per acara, JSON-LD mode kehadiran, dan sitemap acara ditambahkan 21 Oktober 2026. |
| Akses per jenis akun (.sch.id edukatif saja, saklar wajib verifikasi) | **Repository implemented** | Migration 202610200001 (terpasang di production 21 Okt, belum diuji fungsi); saklar Owner default OFF. |
| Kontak dan media sosial resmi di footer | **Repository implemented** | Migration 202610200002 (terpasang di production 21 Okt, belum diuji fungsi); diisi Owner di /owner/contact, kosong sampai diisi. |
| Event Blast (pengumuman ke peserta) | **Disabled** | Dua lapis: izin teknis env `EVENT_BLAST_ENABLED` plus saklar Owner di /owner/events (migration 202610300002, default mati, tercatat di Riwayat). Butuh migration 202610210002 karena versi lama selalu gagal. Server action pengumuman kini juga menolak saat saklar mati. |
| Kalender Circle dan ikuti kalender | **Repository implemented** | Migration 202610210002 (terpasang di production 21 Okt, belum diuji fungsi); notifikasi lewat trigger database. |
| Foto sampul acara | **Repository implemented** | Migration 202610210003 (terpasang di production 21 Okt), bucket event-covers; unggah belum diuji ke Storage sungguhan. |
| Acara online dan hybrid | **Repository implemented** | Migration 202610210003 (terpasang di production 21 Okt, belum diuji fungsi); link hanya untuk penyelenggara, tim, dan peserta terdaftar. |
| Ulasan, rekap, dan sertifikat acara | **Repository implemented** | Migration 202610210004 (terpasang di production 21 Okt, belum diuji fungsi); halaman cek publik /certificates/[kode]; permintaan ulasan otomatis ikut penjadwal yang masih OFF. |
| Email ke peserta acara | **Repository implemented / Disabled** | Migration 202610300001 (belum dipasang di production). Izin teknis env `EVENT_EMAIL_ENABLED` plus saklar Owner "Email pengumuman" di /owner/events (migration 202610300002); butuh juga pengumuman aktif, layanan email, dan service role. Owner tidak bisa menyalakan sebelum semua syarat tercentang. Penyelenggara mencentang "Kirim juga lewat email" saat membuat pengumuman; sekali per pengumuman, maksimal 2 per hari, hanya peserta diterima yang tidak mematikan email. Alamat hanya dibaca server lewat service role, penyelenggara cuma melihat jumlah terkirim/gagal. Peserta bisa berhenti lewat tautan di email (halaman konfirmasi `/email/berhenti`) atau Pengaturan. Belum diuji kirim ke email sungguhan. |
| Simpan Acara publik | **Local/device only** | Bookmark tersimpan di localStorage perangkat; filter melalui /events?saved=1; belum sinkron akun/Supabase. |
| Account & Privacy controls | **Remote rollout verified menurut PRD** | Profil, privasi, blokir, discoverability, deletion lifecycle. |
| Safety Meeting Flow | **Remote rollout verified menurut PRD** | Proposal/consent dua pihak, tempat publik, cancel, local share, pre/post check; tanpa live location. |
| Student Verification | **Disabled** | Global flag OFF. Bukan fitur live publik. |
| PDDikti lookup foundation | **Database remote verified dengan data sintetis; provider disabled** | Provider nyata belum diuji/diaktifkan. Manual fallback tersedia dalam implementasi. |
| LinkedIn verification | **Repository implemented / Disabled** | Membutuhkan akses resmi LinkedIn dan flag; bukan login utama dan tidak memberi badge mahasiswa sendiri. |
| Staff/Admin/Owner shell | **Repository implemented** | Capability-based; remote state setiap migration perlu diperiksa. |
| StudyDate Free/Plus entitlement | **Remote rollout verified menurut SCHEMA** | Free default, Plus berbasis timestamp. |
| AutoGoPay GoPay QRIS | **Schema deployed / Disabled** | Checkout kill switch OFF sampai secret dan audit production selesai. |
| Telegram Anonymous Chat Companion | **Repository implemented / Disabled** | Migration, secret, BotFather, webhook, scheduler, dan real-bot audit harus diverifikasi. |
| Mobile Android/iOS | **Planned / foundation folder exists** | Expo + React Native + TypeScript; belum aplikasi store production. |
| Recommendation algorithm | **Not implemented** | Jangan tampilkan ranking atau skor palsu. |
| Push/Web Push/native notification | **Not implemented** | Notification saat ini in-app. |
| Attachment, voice, video chat | **Not implemented** | Chat utama masih text/emoji/official sticker. |
| Edit/hapus pesan, pin/archive/mute | **Not implemented** | Memerlukan aturan server dan privacy/moderation baru. |

### Drift dokumentasi yang harus diketahui

Ada beberapa catatan rollout yang berbeda antar dokumen karena update dilakukan bertahap. Contoh utama:

- context/PRD.md section 11d menyebut migration Circle/Event Notification belum remote, sedangkan context/SCHEMA.md mencatat 202608170006 deployed.
- PRD menyebut Event v2 migration 202608220002–003 belum production, sementara migration fix 202608240001 dicatat deployed di SCHEMA.
- README memiliki catatan baseline lama dan tidak selalu menjadi sumber status rollout terbaru.

Claude harus menganggap status tersebut **belum pasti** sampai membandingkan migration lokal dengan remote memakai proses terkontrol. Jangan merapikan kontradiksi dengan menebak.

---

## 12. Detail fitur sosial mahasiswa

### People Discovery

Safe projection boleh menampilkan:

- alias anonim;
- mascot/avatar anonim;
- kampus;
- program studi;
- jenjang/semester bila sesuai;
- wilayah umum;
- minat;
- connection goals;
- short intro;
- genuine verification status.

Tidak boleh menampilkan:

- nama lengkap/legal;
- foto jelas sebelum reveal;
- email;
- NIM;
- telepon;
- kontak sosial;
- alamat/lokasi presisi;
- Auth ID atau UUID;
- evidence;
- status consent satu sisi.

Filter dasar kampus dan program studi tersedia untuk Free. Filter lanjutan seperti semester, wilayah, tujuan, dan minat mengikuti entitlement Plus. Server harus mengabaikan filter premium dari akun Free, bukan hanya menyembunyikan kontrol UI.

### Perkenalan

- Pesan pembuka 12–300 karakter.
- Plain text.
- Filter kontak best-effort.
- Satu pending per pasangan.
- Cooldown 7 hari setelah decline/cancel untuk arah sender ke recipient yang sama.
- Security rate limit 5 per jam dan 15 per hari berlaku untuk semua paket.
- Kuota produk peluncuran: Free 3 kiriman dan 3 pending aktif; Plus 10/10.
- Pending kedaluwarsa setelah 14 hari.
- Staff aktif tidak dapat mengirim atau menerima.
- Block menutup pending dan mencegah request baru.
- Accept tidak membuka identitas atau kontak.

### Anonymous Chat

Kemampuan inti repository:

- pesan teks;
- Unicode emoji;
- official StudyDate stickers;
- unread state;
- end conversation;
- block;
- report;
- Kenal Lebih Jauh;
- ajak ke Circle/Acara;
- pencarian percakapan berdasarkan nama samaran, kampus, atau program studi;
- pencarian isi pesan yang sudah dimuat;
- navigasi hasil pencarian;
- draf lokal per percakapan;
- salin pesan;
- menu Balas/Salin/Reaksi;
- polling aman sebagai fallback.

Jangan menyebut chat “sama persis dengan WhatsApp atau Telegram”. Tujuannya adalah memiliki kemampuan inti percakapan yang relevan untuk StudyDate, bukan meniru seluruh aplikasi komunikasi.

Belum termasuk:

- full-history server search;
- lampiran user;
- voice note;
- panggilan suara/video;
- edit/hapus pesan;
- pin/archive/mute;
- public presence;
- last seen;
- push notification.

### Circle

- Discovery open atau satu kampus.
- Join langsung pada v1.
- Owner Circle mengelola metadata, anggota, dan archive.
- Membership active, left, atau removed.
- Diskusi plain text maksimal 800 karakter.
- Tidak ada attachment, rich embed, voice, atau video.
- Circle/message dapat dilaporkan dengan evidence terbatas.
- Membership tidak membuat private conversation.
- Kuota peluncuran: Free membuat 1 dan mengikuti 3 Circle aktif; Plus membuat 3 dan mengikuti 10.
- Security rate limit tetap berlaku untuk semua paket.

### Acara

Baseline v1:

- discover Event terbuka atau satu kampus;
- buat Event di tempat publik;
- RSVP dan cancel;
- capacity atomik;
- report Event/organizer;
- organizer otomatis peserta;
- schedule dan venue terkunci setelah non-organizer pertama RSVP;
- daftar peserta aman hanya untuk organizer dan peserta aktif;
- co-attendance tidak membuka identitas/kontak.

Arah dan implementasi Event lanjutan:

- registration dengan approval atau instant confirmation;
- pending, going, waitlisted, declined, cancelled;
- pertanyaan pendaftaran;
- organizer, cohost, dan check-in staff;
- FIFO waitlist;
- chat peserta;
- Circle association;
- tiket Event-specific;
- QR dan manual check-in;
- halaman manage, registrations, check-in, team, settings, dan report;
- Owner controls;
- reminder 24 jam/2 jam setelah scheduler diaktifkan;
- public share, calendar .ics, dan Google Calendar;
- bookmark publik local/device only.

Event benchmark boleh belajar dari Luma, tetapi StudyDate harus mempertahankan konteks kampus, anonimitas, consent, dan integrasi ke People/Circle.

---

## 13. Verifikasi mahasiswa, PDDikti, dan LinkedIn

### Tujuan

Verifikasi adalah sinyal kepercayaan tambahan, bukan jaminan perilaku, keamanan, atau identitas legal penuh.

### Syarat badge mahasiswa

Badge mahasiswa hanya boleh diterbitkan bila:

1. data akademik cocok melalui pemeriksaan PDDikti/manual yang sah;
2. kepemilikan akun dibuktikan melalui email kampus allowlisted atau review kartu mahasiswa;
3. reviewer aktif memberi persetujuan akhir.

### Status UI

- Belum terverifikasi
- Sedang diperiksa
- Perlu tindakan
- Terverifikasi
- Data belum dapat diverifikasi
- Kedaluwarsa

### PDDikti

Repository memiliki provider adapter server-only yang replaceable dan manual screenshot fallback. Auto-match membutuhkan NIM, nama legal, kampus, dan program yang exact setelah normalisasi.

not_found, mismatch, timeout, dan provider unavailable harus beralih ke pemeriksaan manual tanpa membocorkan kandidat lain.

Status per 9 Oktober 2026:

- migration foundation lookup telah diverifikasi remote memakai data sintetis;
- provider nyata tetap OFF;
- Student Verification global tetap OFF;
- controlled public rollout belum dimulai;
- jangan menyebut PDDikti “live” hanya karena database atau UI ada.

### LinkedIn

LinkedIn adalah lapisan opsional terpisah:

- bukan login utama StudyDate;
- bukan pengganti PDDikti;
- bukan pengganti bukti kepemilikan email/kartu;
- tidak memberi badge mahasiswa dengan sendirinya;
- hanya boleh menampilkan status akun terhubung dan kategori IDENTITY atau WORKPLACE yang benar-benar dikirim LinkedIn;
- pendidikan yang ditulis sendiri di profil LinkedIn tidak dianggap verifikasi mahasiswa.

Implementation tersedia di repository, tetapi flag default OFF dan membutuhkan akses API resmi LinkedIn, client credentials, callback, versi API, key hashing, dan controlled audit.

---

## 14. Telegram Companion

Telegram Companion bukan produk terpisah dan bukan cara baru mencari orang. Ia adalah transport teks opsional untuk Anonymous Chat StudyDate yang sudah ada.

Alur:

1. Pengguna membuat sesi link di StudyDate.
2. StudyDate menghasilkan token opaque berumur 10 menit.
3. /start token di @StudyDateBot hanya menghasilkan pending state.
4. Pengguna kembali ke StudyDate.
5. Pengguna mengonfirmasi binding.
6. Relay aktif untuk satu percakapan.

Aturan:

- bukan login;
- bukan discovery;
- bukan random matching;
- bukan DM baru;
- bukan Contact Reveal;
- satu relay aktif per pengguna pada v1;
- switch perlu konfirmasi;
- counterpart tidak diberi sinyal bahwa relay diubah;
- Telegram identity tidak diproyeksikan;
- text only;
- group/media ditolak;
- Mutual Interest, Identity Reveal, dan Contact Reveal tetap web-only;
- ingress tetap melewati normalisasi, rate limit, filter kontak, block, lifecycle, staff, dan deletion gate;
- outbound memakai durable outbox, bounded batch, lease, retry, dan server-only runner.

Status: repository implemented, tetapi default OFF. Jangan menyebut aktif sebelum migration, encryption/HMAC keys, BotFather, webhook secret, Vercel Cron, dan controlled real-bot audit berhasil.

---

## 15. Membership dan pembayaran

### Paket

**StudyDate Free** adalah default.  
**StudyDate Plus** adalah paket berjangka tanpa auto-renew:

- 7 hari: Rp9.000
- 30 hari: Rp19.000
- 90 hari: Rp49.000

Pembelian saat Plus aktif menambah durasi dari tanggal berakhir sebelumnya.

### Kuota peluncuran

| Kemampuan | Free | Plus |
|---|---:|---:|
| People discovery per hari | 10 | 40 |
| Perkenalan per hari | 3 | 10 |
| Perkenalan aktif | 3 | 10 |
| Circle dibuat aktif | 1 | 3 |
| Circle diikuti aktif | 3 | 10 |
| Filter discovery lanjutan | Tidak | Ya |

Angka ini adalah konfigurasi peluncuran dan dapat berubah. Jangan menganggapnya kebenaran bisnis permanen.

### Prinsip

- Downgrade tidak menghapus koneksi/Circle yang sudah ada.
- Quota menolak creation/join baru sampai penggunaan turun di bawah batas.
- Security rate limit tidak menjadi lebih longgar untuk Plus.
- Badge Plus tidak tampil di People.
- Safety, consent, block, report, reveal, verification, dan account deletion tidak boleh di-paywall.

### AutoGoPay

Hanya GoPay QRIS yang direncanakan pada adapter sekarang. OVO, ShopeePay, dan OrderKuota tidak digunakan. Schema billing telah ada, tetapi checkout kill switch tetap OFF sampai secret dipastikan baru dan audit production selesai.

---

## 16. Safety, privacy, dan moderation invariants

Aturan berikut tidak boleh rusak saat refactor:

1. People hanya memproyeksikan data anonim yang disetujui.
2. Accept perkenalan tidak membuka identitas.
3. Consent satu sisi selalu privat.
4. Identity Reveal membutuhkan Mutual Interest selesai dan consent dua pihak terpisah.
5. Contact Reveal bersifat conversation-scoped dan per channel.
6. Circle/Event membership tidak memberi akses ke data privat.
7. Block, report, end conversation, dan account deletion selalu tersedia.
8. Student, Admin, dan Owner dipisahkan oleh role/capability server-authoritative.
9. NIM, nama legal, evidence, token, raw UUID, storage path, dan contact value tidak masuk public projection.
10. PDDikti dan LinkedIn tidak menggantikan keputusan verifikasi lengkap.
11. Pertemuan hanya dianjurkan di tempat umum; jangan menjanjikan “100% aman”.
12. Jangan menyimpan live location, alamat privat, atau emergency contact pada Meeting Flow.
13. Moderation evidence harus scoped ke laporan dan dibatasi.
14. Shared history dapat ditombstone saat akun dihapus; data privat harus dipurge sesuai lifecycle.
15. Service role hanya server-side.

Public Safety Center tersedia di /safety. Community Guidelines tersedia di /community-guidelines.

---

## 17. Arsitektur teknis

### Stack utama

- Next.js 16.3.0 App Router
- React 19.2.8
- TypeScript
- Tailwind CSS 3.4
- Radix UI primitives
- Lucide icons
- Zod
- Supabase SSR dan Supabase JS
- Supabase Auth, Postgres, RLS, RPC, dan private Storage
- Vercel hosting dan Analytics
- Nodemailer atau Resend untuk email StudyDate
- ZXing browser untuk QR scanner
- qrcode.react untuk tiket QR
- nanoid dan Sharp

### Pembagian tanggung jawab

**Browser/client**

- rendering interaktif;
- local draft;
- local saved Event bookmark;
- capability-aware UI;
- tidak membuat keputusan authorization.

**Next.js server**

- route protection;
- session verification;
- server action/route validation;
- safe redirect;
- email;
- provider adapter;
- encryption boundary;
- webhook validation;
- protected internal runner;
- service-role operations.

**Supabase/Postgres**

- source of truth;
- RLS;
- constraints;
- atomic RPC;
- rate limits;
- safe projections;
- audit events;
- durable outbox;
- account lifecycle.

**External services**

- Resend/SMTP untuk email;
- PDDikti provider opsional dan disabled;
- LinkedIn verification opsional dan disabled;
- Telegram bot opsional dan disabled;
- AutoGoPay opsional dan disabled;
- Vercel Cron untuk runner terproteksi ketika disetujui.

### Prinsip data access

- Hindari broad client SELECT ke tabel privat.
- Gunakan RPC safe projection.
- Actor berasal dari auth.uid(), bukan user ID kiriman client.
- SECURITY DEFINER memakai search_path eksplisit.
- Direct grants harus minimum.
- RLS dan constraint tetap menjadi enforcement, bukan sekadar UI.
- Server-only secret tidak boleh memiliki prefix NEXT_PUBLIC_.

---

## 18. Domain data utama

Detail final selalu mengikuti migration di supabase/migrations.

### Identity dan onboarding

- auth.users
- profiles
- onboarding_academic_claims
- privacy_preferences
- user_consents
- early_access_waitlist
- account_deletion_requests
- account lifecycle/audit policy

### Verification

- student_verification_requests
- campus_email_domains
- campus_email_verifications
- linkedin_verification_links
- verification_events
- private evidence Storage

### People dan koneksi

- safe People RPC projection
- introduction_requests
- conversation_shells
- anonymous_messages
- conversation_events
- conversation_mutual_interests
- identity reveal preparation/consent/snapshot
- contact reveal preparation/consent/ciphertext
- user_blocks
- user_reports

### Circle

- study_circles
- study_circle_memberships
- study_circle_messages
- scoped reports/evidence

### Events

- campus_events
- campus_event_rsvps/registrations
- registration questions/answers
- Event team roles
- waitlist
- Event chat
- tickets and check-ins
- reminders/receipts
- Event reports

### Operations dan monetisasi

- staff_members
- staff_role_events
- user_notifications
- membership entitlements
- quota usage
- offers/orders/payment events
- moderation cases/audit

### Telegram

- binding/link sessions
- conversation relays
- update receipts
- delivery outbox
- encrypted routes dan keyed identity fingerprints

Jangan memakai daftar ini untuk membuat SQL. Baca migration aktual dan context/SCHEMA.md.

---

## 19. Route map penting

### Publik

- /
- /about
- /events
- /events/[publicSlug]
- /events/[publicSlug]/calendar.ics
- /certificates/[code] (cek keaslian sertifikat, noindex)
- /certificates/[code]/image
- /insight
- /insight/[slug]
- /privacy
- /terms
- /community-guidelines
- /safety
- /help
- /login
- /early-access/revise

### Auth

- /auth/login
- /auth/callback
- /auth/confirm
- /auth/error
- /auth/forgot-password
- /auth/update-password
- /onboarding

### Mahasiswa

- /app
- /app/people
- /app/people/[alias]
- /app/introductions
- /app/messages
- /app/messages/[publicId]
- /app/circles
- /app/circles/create
- /app/circles/[publicSlug]
- /app/events
- /app/events/create
- /app/events/[publicSlug]
- /api/events/[publicSlug]/cover (unggah/hapus sampul, POST dan DELETE)
- /app/profile
- /app/settings
- /app/account/privacy
- /app/notifications
- /app/membership
- /app/verification
- /app/certificates

### Organizer Event

- /app/events/[publicSlug]/manage
- /manage/registrations
- /manage/check-in
- /manage/check-in/scan
- /manage/team
- /manage/settings
- /manage/after
- /manage/report

### Staff/Admin

- /staff/login
- /staff/early-access
- /staff/users
- /staff/users/[accountRef]
- /admin
- /admin/verifications
- /admin/verifications/[requestId]
- /admin/campuses
- /admin/study-programs
- /admin/events

### Owner

- /owner
- /owner/early-access
- /owner/moderation
- /owner/moderation/[reportId]
- /owner/staff
- /owner/memberships
- /owner/campuses
- /owner/study-programs
- /owner/events
- /owner/audit
- /owner/contact

Route dapat bertambah. Periksa app/ sebelum mengandalkan daftar ini.

---

## 20. Environment dan integrations

Nama variable dapat dilihat di .env.example. Kelompok utama:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- NEXT_PUBLIC_SITE_URL
- SUPABASE_SERVICE_ROLE_KEY
- STUDYDATE_EMAIL_FROM
- STUDYDATE_RESEND_API_KEY atau STUDYDATE_SMTP_*
- STUDENT_VERIFICATION_ENCRYPTION_KEY
- STUDENT_VERIFICATION_HMAC_KEY
- STUDENT_VERIFICATION_ENABLED
- STUDENT_VERIFICATION_TEST_USER_IDS
- STUDENT_VERIFICATION_REVIEWER_USER_ID
- STUDENT_VERIFICATION_CLEANUP_SECRET
- PDDIKTI_LOOKUP_PROVIDER_ENABLED
- PDDIKTI_PROVIDER_BASE_URL
- PDDIKTI_PROVIDER_ACCESS_KEY
- LINKEDIN_VERIFICATION_ENABLED
- LINKEDIN_CLIENT_ID dan LINKEDIN_CLIENT_SECRET
- LINKEDIN_*_API_VERSION
- LINKEDIN_MEMBER_HASH_KEY
- CONTACT_REVEAL_ENCRYPTION_KEY
- EVENT_TICKET_SECRET
- TELEGRAM_COMPANION_ENABLED
- TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBHOOK_SECRET
- TELEGRAM_COMPANION_ENCRYPTION_KEY
- TELEGRAM_COMPANION_HMAC_KEY
- CRON_SECRET
- AUTOGOPAY_ENABLED
- AUTOGOPAY_API_KEY

Jangan pernah mengisi nilai rahasia di dokumentasi, commit, issue, screenshot, atau chat.

---

## 21. Security posture yang diketahui

Aplikasi telah memasang header seperti:

- Content-Security-Policy
- Permissions-Policy
- Referrer-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options

External header scan pada 9 Oktober 2026 memberi grade A, tetapi tetap memberi warning karena script-src memuat unsafe-inline. Scan juga mengamati Access-Control-Allow-Origin: * pada response. Grade header bukan bukti keamanan aplikasi secara keseluruhan.

Jika memperketat CSP:

- verifikasi kebutuhan Next.js runtime;
- gunakan nonce/hash bila arsitektur mendukung;
- uji seluruh auth, analytics, Supabase, QR, dan client hydration;
- jangan menghapus unsafe-inline tanpa browser verification;
- periksa CORS di route/API secara terpisah dari static page response.

Security checklist produk tetap mencakup auth, RLS, safe projection, rate limit, encryption, audit, storage privacy, webhook signatures, account deletion, dan moderation.

---

## 22. Mobile roadmap

Keputusan stack: satu aplikasi **Expo + React Native + TypeScript** untuk Android dan iOS. Fondasi berada di folder mobile/.

Tahapan:

1. Konsistensi arah produk dan bahasa web.
2. Fondasi app: Expo Router, environment, login, secure session, design tokens, deep link, loading/error/offline.
3. Alur koneksi: People, perkenalan, Anonymous Chat, Kenal Lebih Jauh, reveal, block, report.
4. Circle dan Acara: discovery, registration, waitlist, ticket, QR check-in, native notifications.
5. Telegram companion integration.
6. StudyDate Plus dan store billing.
7. Internal build, synthetic test, closed beta kampus, staged production release.

Admin dan Owner tetap web-first.

Rencana store:

- gunakan akun badan usaha untuk arah brand nasional;
- tetapkan package identifier permanen seperti id.studydate.app;
- siapkan support email, Privacy, Terms, Help, moderation, dan account deletion;
- closed beta pertama memakai kampus/kelompok terbatas;
- digital subscription mengikuti aturan Google Play Billing dan Apple IAP;
- cek kembali kebijakan store terbaru sebelum submission.

Roadmap bukan bukti aplikasi mobile sudah siap rilis.

---

## 23. Ukuran keberhasilan

Prioritaskan metrik yang mencerminkan nilai dan kesehatan produk:

- onboarding completion;
- kualitas perkenalan;
- reply rate;
- conversation safety;
- report handling;
- Circle participation;
- Event registration dan attendance;
- user-controlled reveal;
- abuse rate yang rendah;
- retention yang sehat;
- keberhasilan pengguna menemukan konteks belajar atau kolaborasi.

Jangan menampilkan angka target atau klaim traction ke publik sebelum disetujui dan dibuktikan.

---

## 24. Yang belum boleh dijanjikan

Jangan menjanjikan:

- “sama persis dengan Luma”;
- “fitur chat selengkap WhatsApp/Telegram”;
- PDDikti live untuk semua mahasiswa;
- verifikasi otomatis LinkedIn;
- bot Telegram production;
- pembayaran production;
- realtime chat production jika migration belum terverifikasi;
- push notification;
- mobile app sudah ada di Play Store/App Store;
- sistem rekomendasi pintar;
- moderasi otomatis penuh;
- keamanan 100%;
- identitas semua pengguna pasti asli;
- semua Event v2 sudah production.

Gunakan jawaban jujur: sebutkan bagian yang sudah ada, statusnya, dan sisa rollout yang konkret.

---

## 25. Prioritas produk berikutnya

Urutan yang masuk akal berdasarkan arah sekarang:

1. Tutup dokumentasi drift dan inventaris remote migration.
2. Stabilkan People → Perkenalan → Chat → Consent → Safety pada akun uji.
3. Verifikasi rollout fitur chat terbaru: realtime signal, typing, reply, reaction, dan fallback.
4. Selesaikan dan live-audit Event v2 secara bertahap.
5. Sinkronkan bookmark Event ke akun hanya jika benar-benar dibutuhkan; local bookmark saat ini tetap jujur.
6. Aktifkan Student Verification hanya melalui pilot kecil dan terkontrol.
7. Aktifkan Telegram Companion setelah security matrix dan real-bot audit.
8. Aktifkan AutoGoPay setelah secret rotation, webhook audit, dan reconciliation test.
9. Siapkan analytics yang tidak merekam isi chat atau data pribadi.
10. Mulai closed beta kampus sebelum ekspansi nasional.
11. Pindahkan pengalaman mahasiswa prioritas ke mobile setelah web menjadi kontrak stabil.

Supabase bukan sekadar pekerjaan “paling belakang”; schema, RLS, dan RPC adalah enforcement. Namun activation remote, provider eksternal, dan data production harus dilakukan setelah flow dan rollout plan siap.

---

## 26. Peta dokumen source of truth

Baca sesuai kebutuhan:

1. [AGENTS.md](./AGENTS.md) — aturan Next.js repository.
2. [context/PRODUCT_DIRECTION.md](./context/PRODUCT_DIRECTION.md) — tujuan produk dan positioning.
3. [context/MVP.md](./context/MVP.md) — batas rilis awal.
4. [context/PRD.md](./context/PRD.md) — perilaku fitur lengkap.
5. [context/DESIGN.md](./context/DESIGN.md) — visual, copy, UX, accessibility, responsive.
6. [context/ARCHITECTURE.md](./context/ARCHITECTURE.md) — trust boundary dan implementasi.
7. [context/SCHEMA.md](./context/SCHEMA.md) — ringkasan data dan migration status.
8. [context/ERD.md](./context/ERD.md) — relasi data.
9. [context/RULES.md](./context/RULES.md) — batas kerja agent.
10. [context/MOBILE_APP_ROADMAP.md](./context/MOBILE_APP_ROADMAP.md) — Android/iOS.
11. [CHATGPT.md](./CHATGPT.md) dan [GEMINI.md](./GEMINI.md) — instruksi agent lain.
12. app/, components/, lib/, tests/, scripts/, dan supabase/migrations/ — implementasi aktual.

Urutan kebenaran untuk keputusan teknis:

1. permintaan terbaru pemilik produk;
2. aturan keselamatan dan akses;
3. migration/kode/test aktual;
4. dokumen konteks terbaru;
5. README;
6. asumsi model.

Untuk database, migration aktual selalu lebih kuat daripada diagram atau ringkasan.

---

## 27. Workflow perubahan untuk Claude

1. Nyatakan pemahaman tentang hasil yang diminta.
2. Baca route, component, service, validation, migration, dan test yang relevan.
3. Tentukan status fitur saat ini.
4. Identifikasi privacy boundary dan role yang terdampak.
5. Implementasikan perubahan terkecil yang lengkap.
6. Reuse token, komponen, istilah, dan pola yang sudah ada.
7. Tambah/perbarui test fokus.
8. Jalankan test fitur lebih dulu.
9. Jalankan lint, typecheck, dan build bila praktis.
10. Gunakan npm run verify:release sebelum release candidate.
11. Uji long copy dan viewport 375, 768, 1024, 1440 untuk perubahan UI.
12. Perbarui PRD/DESIGN/ARCHITECTURE/SCHEMA/ERD bila kontrak berubah.
13. Laporkan file yang berubah, test yang benar-benar dijalankan, status deployment, dan pekerjaan tersisa.
14. Jangan mengklaim command lulus jika tidak dijalankan atau gagal.
15. Jangan menganggap commit ke main otomatis membuktikan deployment production berhasil.

### Checklist sebelum menjawab “sudah selesai”

- Apakah scope yang diminta benar-benar selesai?
- Apakah test relevan dijalankan?
- Apakah build berhasil?
- Apakah perubahan sudah masuk main?
- Apakah deployment/check status berhasil?
- Apakah migration remote diperlukan?
- Apakah feature flag masih OFF?
- Apakah provider eksternal sudah diuji?
- Apakah browser/mobile flow sudah diverifikasi?
- Apakah ada bagian local-only?
- Apakah bahasa pengguna tetap sederhana?
- Apakah data privat tetap tersembunyi?

Jika ada satu jawaban “belum”, jelaskan dengan jujur. Jangan menyamarkannya sebagai selesai.

---

## 28. Ringkasan untuk konteks cepat Claude

Jika hanya punya waktu singkat, ingat ini:

- StudyDate ID adalah jaringan sosial kampus untuk teman belajar, koneksi, Circle, dan Acara.
- Dating hanyalah hasil opsional, bukan positioning.
- Alur inti adalah People → Perkenalan → Anonymous Chat → Kenal Lebih Jauh → Buka Identitas → Bagikan Kontak → Pertemuan publik bila keduanya mau.
- Privacy dan consent bertahap adalah pembeda utama.
- Circle dan Acara menjadi growth loop dan konteks koneksi.
- Luma adalah benchmark Event, bukan template yang harus disalin.
- Bahasa harus santai, jelas, dan awam; UI tidak boleh terasa seperti developer console.
- Next.js + React + TypeScript + Supabase adalah stack utama.
- Banyak kemampuan tersedia di repository, tetapi beberapa rollout remote/flag masih belum aktif.
- PDDikti, LinkedIn, Telegram, AutoGoPay, realtime chat terbaru, dan sebagian Event v2 wajib diverifikasi sebelum disebut live.
- Mobile memakai Expo/React Native pada roadmap.
- Jangan bocorkan data privat, jangan membuat klaim palsu, dan jangan berkata 100% aman.
