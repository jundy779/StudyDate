# Rencana menyalakan fitur Acara

Disusun 21 Oktober 2026. Dokumen ini mengurutkan fitur Acara yang sudah ada di
repository tetapi masih mati, beserta syarat, cara menyalakan, cara memeriksa, dan
cara mematikan lagi. Ikuti urutannya, karena tiap tahap bergantung pada tahap
sebelumnya.

Aturan umum:
- Setiap langkah di Supabase production dan Vercel butuh persetujuan Owner.
- Nyalakan satu tahap, uji dengan akun uji, baru lanjut ke tahap berikutnya.
- Flag yang tidak bernilai persis `true` dianggap mati.

## 0. Prasyarat untuk semua tahap

- [x] Migration sampai `202610210004_event_after_v1.sql` sudah terpasang di production
      (21 Oktober 2026, `supabase db push`). Periksa dengan:
      `select version from supabase_migrations.schema_migrations order by version desc limit 10;`
- [ ] Ada satu akun penyelenggara uji (terverifikasi atau diberi izin Owner) dan dua
      akun peserta uji yang sudah selesai onboarding.
- [ ] Ada satu acara uji dengan cakupan "terbuka" dan kapasitas kecil (misalnya 3).

## 1. Pengingat 24 jam dan 2 jam

Kode: `product_scheduler_tick()` (migration `202608210004`). Notifikasi masuk ke
Pusat Notifikasi, belum lewat email.

Menyalakan (SQL Editor Supabase):

```sql
select cron.schedule(
  'studydate-product-scheduler-v1',
  '*/15 * * * *',
  $$select public.product_scheduler_tick();$$
);
```

Memeriksa:
- [ ] `select job_name, last_started_at, last_succeeded_at, last_result_count from public.product_scheduler_runs;`
      menunjukkan `last_succeeded_at` diperbarui tiap 15 menit. Anggap bermasalah bila
      lebih dari 45 menit tanpa sukses.
- [ ] Peserta uji acara yang mulai dalam 24 jam menerima satu notifikasi, bukan dua.
- [ ] Tick berulang tidak menggandakan `campus_event_reminder_receipts`.

Mematikan: `select cron.unschedule('studydate-product-scheduler-v1');`

## 2. Pengumuman ke peserta (Event Blast)

Kode: migration `202610160001_event_blast_v1`, flag `EVENT_BLAST_ENABLED`.
Wajib pasang `202610210002_circle_calendar_v1.sql` dulu. Tanpa itu pengumuman selalu
gagal karena tiga hal yang ditemukan saat uji lokal: bucket `announcement_day` tidak
diizinkan oleh pembatas frekuensi, target notifikasi `#event-announcements` ditolak
batasan database, dan kolom `recipient_count` ambigu di fungsi pengirim.
Pengumuman tampil di halaman acara dan notifikasi, maksimal 5 per hari per penyelenggara.

Menyalakan: set `EVENT_BLAST_ENABLED=true` di Vercel (Production), lalu redeploy.

Memeriksa:
- [ ] Penyelenggara uji bisa mengirim pengumuman dari halaman kelola acara.
- [ ] Hanya peserta berstatus terdaftar yang menerima, akun lain tidak.
- [ ] Pengumuman keenam di hari yang sama ditolak.

Mematikan: set `EVENT_BLAST_ENABLED=false`, redeploy.

## 2b. Kalender Circle dan fitur ikuti

Kode: migration `202610210002_circle_calendar_v1.sql`. Tidak ada flag; fitur muncul
otomatis di halaman Circle setelah migration terpasang, dan disembunyikan bila belum.

Memeriksa:
- [ ] Pemilik Circle menautkan acara dari Kelola acara, Pengaturan, Study Circle.
      Acara muncul di bagian "Kalender acara" halaman Circle.
- [ ] Akun lain menekan "Ikuti kalender". Saat acara baru ditautkan, akun itu menerima
      notifikasi "Acara baru di kalender yang kamu ikuti".
- [ ] Akun beda kampus tidak melihat kalender Circle satu kampus, dan akun yang
      memblokir pemilik tidak bisa mengikuti.
- [ ] Halaman Acara menampilkan "Dari kalender yang kamu ikuti".

Mematikan: tidak ada saklar. Bila perlu, hapus trigger
`campus_event_circle_links_notify_followers` untuk menghentikan notifikasi.

## 2c. Foto sampul, acara online, dan pratinjau saat dibagikan

Kode: migration `202610210003_event_cover_online_v1.sql`. Tidak ada flag. Sebelum
migration terpasang, unggah sampul dan mode online menampilkan pesan "belum tersedia",
dan semua acara tetap tampil seperti biasa.

Isi migration:
- Kategori tempat `online`. Acara online tidak memakai konfirmasi tempat publik; acara
  tatap muka tetap wajib empat konfirmasi seperti sebelumnya.
- Tabel privat `campus_event_online_links`. Link hanya dibuka untuk penyelenggara,
  cohost, petugas check-in, dan peserta berstatus terdaftar. Host yang diizinkan:
  Zoom, Google Meet, Microsoft Teams, YouTube, Webex, Jitsi. Wajib https.
- Kolom `campus_events.cover_path` dan bucket publik `event-covers` (hanya WebP,
  maksimal 2 MB, tanpa policy tulis untuk pengguna; server menulis memakai service role).

Memeriksa:
- [ ] Buat acara online dengan link Meet. Akun lain yang belum daftar melihat
      "Link muncul di sini setelah pendaftaranmu diterima", tanpa link.
- [ ] Setelah akun itu terdaftar, tombol "Buka Google Meet" muncul.
- [ ] Halaman publik `/events/...`, file .ics, dan gambar pratinjau tidak memuat link.
- [ ] Unggah foto sampul dari Kelola acara, Pengaturan. Foto tampil di daftar acara,
      detail, dan pratinjau saat link dibagikan (`/events/<slug>/opengraph-image`).
- [ ] Ganti foto: file lama terhapus dari bucket `event-covers`.
- [ ] Sitemap memuat halaman acara resmi publik.

Mematikan: tidak ada saklar. Sampul bisa dihapus per acara. Bila perlu menghentikan
link online, kosongkan tabel `campus_event_online_links`.

## 2d. Ulasan, rekap, dan sertifikat

Kode: migration `202610210004_event_after_v1.sql`. Tidak ada flag. Permintaan ulasan otomatis baru jalan
setelah penjadwal di bagian 1 dinyalakan; tanpa itu, peserta tetap melihat ajakan ulasan di halaman Acara
dan halaman detail acara.

Memeriksa (pakai acara uji yang sudah selesai):
- [ ] Peserta terdaftar mengisi ulasan, lalu mengubahnya. Penyelenggara tidak bisa mengulas acaranya sendiri.
- [ ] Tab "Setelah acara" menampilkan angka gabungan. Komentar baru muncul setelah 3 ulasan, tanpa alias.
- [ ] Rekap pertama mengirim notifikasi ke peserta; mengubah rekap tidak mengirim lagi.
- [ ] Nyalakan sertifikat dengan syarat check-in. Peserta tanpa check-in melihat alasannya.
- [ ] Peserta mengambil sertifikat, membuka `/certificates/<kode>`, dan mengunduh PNG.
- [ ] Penyelenggara mencabut; halaman cek berubah menjadi "tidak berlaku" tanpa nama.
- [ ] Setelah penjadwal menyala: permintaan ulasan terkirim sekali, 1 sampai 48 jam setelah acara.

Mematikan: per acara lewat pengaturan sertifikat. Tidak ada saklar global.

## 2e. Antrean Akses Awal (bukan fitur Acara, dicatat di sini supaya urutan migration jelas)

Kode: migration `202610210005_early_access_queue_insights_v1.sql`. Tanpa flag. Sebelum terpasang, halaman
antrean tetap jalan seperti lama (fallback ke v2) dan ringkasan tidak muncul.

Memeriksa: ringkasan angka muncul di /owner/early-access, "Terlama dulu" mengurutkan benar, pendaftar lama
bertanda merah, tombol "Kirim pengingat" hanya muncul untuk undangan lebih dari 24 jam, dan pengingat kedua
dalam 24 jam ditolak.

## 3. Acara berseri

Kode: migration `202610170002`, `202610170003`, flag `EVENT_SERIES_ENABLED`.
Lihat `context/EVENT_SERIES.md` untuk batasannya (maksimal 12 sesi, mingguan atau
bulanan).

Menyalakan: set `EVENT_SERIES_ENABLED=true` di Vercel, redeploy.

Memeriksa:
- [ ] Buat seri 3 sesi, ubah satu sesi saja, ubah sesi berikutnya, lalu batalkan seri.
- [ ] Laporan gabungan seri menghitung peserta per sesi dengan benar.

Mematikan: set `EVENT_SERIES_ENABLED=false`. Seri yang sudah dibuat tetap ada sebagai
acara biasa.

## 4. Tiket gratis dan tiket dengan kode akses

Kode: migration `202610170004` sampai `202610190005`, flag `EVENT_TICKETING_ENABLED`,
rahasia `EVENT_TICKET_SECRET` (wajib, tanpa ini QR tiket gagal tertutup).

Menyalakan:
1. Pastikan `EVENT_TICKET_SECRET` sudah diisi di Vercel (32 byte Base64 atau 64 hex).
2. Set `EVENT_TICKETING_ENABLED=true`, redeploy.
3. Biarkan `EVENT_TICKET_PAYMENTS_ENABLED=false`.

Memeriksa:
- [ ] Penyelenggara membuat tiket gratis, peserta terdaftar mengambil satu tiket.
- [ ] Tiket kode akses hanya terbuka dengan kode yang benar dan berhenti saat batas
      pemakaian tercapai.
- [ ] Membatalkan pendaftaran mengembalikan kuota tiket.
- [ ] QR masuk dan check-in jalan untuk peserta dengan pesanan selesai.

Mematikan: set `EVENT_TICKETING_ENABLED=false`. Pastikan dulu tidak ada pesanan
berbayar yang masih menunggu (tahap 5 belum aktif, jadi seharusnya kosong).

## 5. Tiket berbayar GoPay QRIS

Belum disarankan dinyalakan. Masih kurang: alur refund, invoice atau bukti bayar,
promo berbayar, dan uji transaksi staging. Syarat minimum sebelum dipertimbangkan:

- [ ] Tahap 4 sudah stabil.
- [ ] Rahasia AutoGoPay baru dan webhook sudah diuji di staging.
- [ ] Pembersihan pesanan kedaluwarsa dijadwalkan (di bawah), supaya kuota yang
      dipesan tapi tidak dibayar kembali dalam hitungan menit.
- [ ] Prosedur refund manual tertulis dan disetujui.

Penjadwal pembersihan pesanan (jalankan hanya saat tahap 5 dinyalakan; butuh
migration `202610210001` karena versi sebelumnya menolak panggilan dari pg_cron dan
dari service role PostgREST versi sekarang):

```sql
select cron.schedule(
  'studydate-event-ticket-order-expiry-v1',
  '*/5 * * * *',
  $$select public.expire_campus_event_ticket_orders(500);$$
);
```

Mematikan penjadwal: `select cron.unschedule('studydate-event-ticket-order-expiry-v1');`

Catatan: rute `app/api/cron/event-ticket-orders` tetap ada untuk pemicu manual, tetapi
sengaja tidak didaftarkan di `vercel.json`. Kebijakan proyek adalah satu Vercel Cron
saja, dan paket Vercel Hobby hanya mengizinkan jadwal harian.

## Catatan perbaikan yang menyertai dokumen ini

- `.env.example`: baris `EVENT_BLAST_ENABLED` sebelumnya tergabung dengan baris lain
  lewat karakter `\n` literal, sehingga tidak pernah terbaca. Sudah dipisah.
- `expire_campus_event_ticket_orders` memeriksa `request.jwt.claim.role`, pengaturan
  lama yang tidak lagi diisi PostgREST. Diuji lokal: panggilan service role dengan
  `request.jwt.claims` ditolak. Migration `202610210001` menyamakannya dengan
  `auth.role()` seperti fungsi lain.
- `reconcile_campus_event_ticket_payment` (migration `202610190001`) memakai pemeriksaan
  lama yang sama, tetapi tidak dipanggil oleh kode mana pun. Bila nanti dipakai,
  perbaiki dulu dengan pola yang sama.
