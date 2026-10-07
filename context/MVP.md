# StudyDate ID — Minimum Viable Product

> Dokumen ini menjelaskan batas produk yang harus siap digunakan pada rilis awal StudyDate ID.
> Detail kebutuhan lengkap tetap berada di [PRD.md](./PRD.md), sedangkan aturan tampilan berada di [DESIGN.md](./DESIGN.md).

## 1. Ringkasan

StudyDate ID adalah platform sosial untuk mahasiswa dan alumni yang ingin menemukan teman belajar, teman diskusi, rekan proyek, circle, dan acara kampus.

Pengguna memulai dari kesamaan akademik atau kegiatan kampus. Unsur hubungan yang lebih dekat tetap boleh berkembang secara alami, tetapi bukan janji utama produk dan tidak ditonjolkan sebagai aplikasi kencan.

Kalimat produk untuk pengguna:

> Cari teman belajar, kenalan baru, circle, dan acara kampus. Mulai pelan-pelan tanpa langsung membagikan nama asli atau kontak.

## 2. Masalah yang diselesaikan

Mahasiswa sering ingin menambah teman atau relasi, tetapi mengalami beberapa hambatan:

- tidak tahu harus mulai berkenalan dari mana;
- khawatir langsung membagikan identitas dan kontak;
- sulit menemukan teman dengan minat atau kebutuhan belajar yang sama;
- informasi circle dan acara kampus tersebar di banyak tempat;
- aplikasi perkenalan umum terlalu berfokus pada penampilan atau hubungan romantis.

StudyDate ID memberi konteks yang lebih jelas untuk memulai: kampus, program studi, minat, tujuan, circle, dan acara.

## 3. Target pengguna awal

### Utama

- mahasiswa aktif di Indonesia;
- mahasiswa lintas kampus yang ingin belajar, berdiskusi, mengikuti kegiatan, atau memperluas relasi;
- pengguna yang nyaman memulai perkenalan secara anonim dan bertahap.

### Pendukung

- alumni yang ingin mengikuti komunitas, networking, atau berbagi pengalaman;
- penyelenggara kegiatan kampus;
- pengelola StudyDate ID yang menangani keamanan, moderasi, dan operasional.

Rollout awal tetap dapat dibatasi pada kampus atau akun uji tertentu sebelum dibuka secara nasional.

## 4. Tujuan MVP

MVP harus membuktikan bahwa pengguna dapat:

1. membuat profil sosial-akademik dengan aman;
2. menemukan orang yang relevan tanpa melihat identitas lengkap;
3. mengirim dan menerima perkenalan;
4. mengobrol tanpa langsung membuka nama asli dan kontak;
5. membuka identitas dan kontak hanya setelah persetujuan kedua pihak;
6. menemukan atau mengikuti Circle belajar dan Acara Kampus;
7. menghentikan interaksi, memblokir, atau melaporkan bila merasa tidak nyaman.

## 5. Alur utama pengguna

### A. Temukan dan kenalan

1. Pengguna masuk melalui email.
2. Pengguna menyelesaikan onboarding.
3. Pengguna melihat profil anonim berdasarkan konteks kampus dan minat.
4. Pengguna mengirim pesan perkenalan.
5. Penerima menerima atau menolak perkenalan.
6. Jika diterima, Anonymous Chat terbuka.
7. Kedua pihak dapat memilih **Kenal Lebih Jauh**.
8. Jika sama-sama setuju, mereka dapat membuka identitas secara bertahap.
9. Telegram, Instagram, atau LinkedIn hanya dibuka per saluran setelah persetujuan dua arah.

### B. Circle mahasiswa

1. Pengguna mencari Circle berdasarkan nama, topik, atau cakupan.
2. Pengguna dapat bergabung, berdiskusi, keluar, atau melaporkan Circle.
3. Anggota tetap tampil dengan identitas aman sesuai aturan StudyDate.
4. Dari Circle, pengguna dapat mengirim perkenalan melalui alur yang sama, bukan langsung memperoleh kontak.

### C. Acara kampus

1. Pengguna mencari acara berdasarkan nama, kategori, dan cakupan.
2. Pengguna membuka detail waktu, tempat publik, kapasitas, dan penyelenggara.
3. Pengguna melakukan RSVP atau mengajukan pendaftaran.
4. Penyelenggara mengelola peserta, waitlist, tiket, dan check-in sesuai fitur yang tersedia.
5. Mengikuti acara tidak otomatis membuka identitas atau kontak peserta lain.

## 6. Cakupan MVP

### P0 — Wajib untuk rilis awal

- landing page dan halaman bantuan, privasi, syarat, panduan komunitas, serta keamanan;
- Early Access dan undangan;
- login tanpa password melalui email;
- onboarding mahasiswa;
- profil anonim dan pengaturan visibilitas;
- People Discovery;
- Introduction Requests;
- Anonymous Chat;
- Mutual Interest dengan istilah publik **Kenal Lebih Jauh**;
- Identity Reveal melalui persetujuan dua arah;
- Contact Reveal per Telegram, Instagram, atau LinkedIn;
- Notification Center dalam aplikasi;
- block, report, mengakhiri percakapan, dan penghapusan akun;
- dashboard mahasiswa;
- Ruang Operasional untuk Owner dan Admin;
- tampilan mobile tanpa halaman bergeser ke samping;
- logging dan audit untuk tindakan staf yang sensitif.

### P1 — Pelengkap sosial yang sudah menjadi bagian arah produk

- Study Circle;
- Campus Events;
- ajakan Circle atau Acara melalui chat;
- RSVP, waitlist, tiket, dan check-in acara;
- pengelolaan acara oleh organizer;
- pengingat acara dalam aplikasi;
- rencana bertemu di tempat umum.

P1 boleh dirilis bertahap setelah P0 stabil. Keberadaan code tidak otomatis berarti fitur sudah aktif di production.

### P2 — Setelah MVP stabil

- rekomendasi orang, Circle, atau acara yang lebih personal;
- pengiriman chat realtime penuh sebagai pengganti polling;
- push notification dan notifikasi aplikasi native;
- aplikasi Android dan iOS;
- integrasi sumber akademik resmi bila akses dan izin tersedia;
- Telegram Bot sebagai kanal pendamping yang sudah diaudit di production;
- pembayaran StudyDate Plus setelah audit production;
- analitik organizer lanjutan;
- fitur acara lanjutan yang mendekati platform event khusus.

## 7. Bukan bagian MVP

Untuk menjaga fokus, MVP tidak mencakup:

- swipe seperti aplikasi kencan;
- skor kecocokan palsu;
- random chat;
- membuka nama asli, foto, atau kontak secara sepihak;
- lokasi langsung atau pelacakan pengguna;
- pertemuan di rumah, kamar kos, apartemen pribadi, atau kamar hotel;
- marketplace tiket publik;
- video call bawaan;
- klaim bahwa pengguna atau pertemuan dijamin aman;
- klaim integrasi PDDikti atau LinkedIn sudah live sebelum lolos pengujian production.

## 8. Verifikasi mahasiswa

Verifikasi mahasiswa bersifat opsional dan terpisah dari alur perkenalan.

Alur yang direncanakan:

1. data akademik diperiksa melalui PDDikti atau bukti akademik yang sesuai;
2. kepemilikan akun dibuktikan melalui email kampus yang disetujui atau kartu mahasiswa privat;
3. reviewer memberikan persetujuan akhir;
4. badge baru ditampilkan setelah seluruh syarat terpenuhi.

LinkedIn hanya menjadi lapisan kepercayaan tambahan. Login LinkedIn, profil dasar, atau pendidikan yang ditulis sendiri tidak boleh dianggap sebagai bukti status mahasiswa.

Selama rollout belum diverifikasi, antarmuka harus menyatakan fitur belum tersedia atau masih diuji. Jangan menampilkan badge palsu.

## 9. Keamanan dan privasi minimum

- Nama lengkap, NIM, email, bukti verifikasi, dan ID internal tidak tampil di profil publik.
- Kontak tidak terbuka saat perkenalan diterima.
- Persetujuan satu pihak tidak boleh diketahui pihak lain sebelum menjadi persetujuan dua arah.
- Pengguna dapat menolak, membatalkan, mengakhiri, memblokir, dan melaporkan.
- Pertemuan offline hanya diarahkan ke tempat umum yang ramai dan masih beroperasi.
- Keamanan dasar tidak boleh dijadikan fitur berbayar.
- Semua tindakan staf terhadap data sensitif harus mengikuti hak akses dan audit.

## 10. Bahasa produk

Bahasa antarmuka harus singkat, santai, dan mudah dipahami mahasiswa.

Gunakan:

- **Cari teman**
- **Kirim perkenalan**
- **Mulai ngobrol**
- **Kenal lebih jauh**
- **Buka identitas**
- **Bagikan kontak**
- **Gabung Circle**
- **Ikuti acara**
- **Ajak lewat chat**

Hindari istilah teknis seperti `mutual interest`, `progressive reveal`, `projection`, `entitlement`, atau `conversation shell` pada antarmuka pengguna.

## 11. Ukuran keberhasilan awal

Ukuran utama:

- pengguna menyelesaikan onboarding;
- pengguna menemukan profil yang relevan;
- perkenalan dikirim dan diterima;
- percakapan aktif terbentuk;
- pengguna kembali untuk membuka chat, Circle, atau Acara;
- RSVP acara dan keanggotaan Circle terjadi secara nyata;
- laporan keamanan dapat ditangani oleh tim operasional.

Angka target ditentukan setelah cohort uji awal tersedia. Jangan mengisi statistik buatan hanya agar dashboard terlihat ramai.

## 12. Syarat MVP dianggap siap

MVP dapat disebut siap untuk uji terbatas bila:

- seluruh alur P0 dapat diselesaikan melalui mobile dan desktop;
- tidak ada horizontal overflow pada ukuran layar utama;
- loading, empty, error, dan retry state tersedia;
- identitas atau kontak tidak bocor sebelum persetujuan;
- block dan report bekerja dari alur yang relevan;
- Owner dan Admin hanya melihat data sesuai kewenangan;
- migration production yang diperlukan sudah diterapkan dan diaudit;
- fitur yang belum aktif menggunakan status atau feature flag yang jujur;
- minimal dua akun uji dapat menyelesaikan alur perkenalan dari awal sampai akhir;
- legal, safety, privacy, serta penghapusan akun dapat diakses pengguna.

## 13. Status dokumentasi

Gunakan tiga status berikut agar tim tidak salah menyebut fitur:

- **Repository implemented:** code sudah tersedia di repository.
- **Remote rollout verified:** fitur sudah diterapkan dan diuji pada environment tujuan.
- **Not implemented:** fitur belum tersedia.

Dokumen ini menentukan batas MVP. [PRD.md](./PRD.md) menjelaskan aturan dan kebutuhan secara lengkap, sedangkan [DESIGN.md](./DESIGN.md) menjadi acuan pengalaman pengguna dan tampilan.
