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

- [ ] Migration acara sampai `202610210001_event_ticket_order_expiry_guard.sql` sudah
      terpasang. Periksa dengan:
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
Pengumuman tampil di halaman acara dan notifikasi, maksimal 5 per hari per penyelenggara.

Menyalakan: set `EVENT_BLAST_ENABLED=true` di Vercel (Production), lalu redeploy.

Memeriksa:
- [ ] Penyelenggara uji bisa mengirim pengumuman dari halaman kelola acara.
- [ ] Hanya peserta berstatus terdaftar yang menerima, akun lain tidak.
- [ ] Pengumuman keenam di hari yang sama ditolak.

Mematikan: set `EVENT_BLAST_ENABLED=false`, redeploy.

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
