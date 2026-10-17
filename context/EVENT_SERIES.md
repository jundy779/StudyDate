# Event Series StudyDate

## Tujuan

Event Series membantu penyelenggara membuat dan mengelola beberapa pertemuan yang masih berada dalam satu rangkaian, misalnya belajar mingguan, kelas persiapan ujian, meetup komunitas, atau rangkaian workshop.

Bahasa di aplikasi sengaja menggunakan istilah yang mudah dipahami mahasiswa. Istilah teknis database tidak ditampilkan kepada pengguna.

## Kemampuan yang tersedia

- Membuat 1 sampai 12 pertemuan mingguan atau bulanan.
- Menjaga jam lokal tetap sama pada setiap pertemuan.
- Menyesuaikan tanggal akhir bulan secara otomatis.
- Melihat seluruh pertemuan dari satu halaman pengelolaan.
- Mengubah pertemuan ini saja.
- Mengubah pertemuan ini dan semua pertemuan setelahnya.
- Mengubah semua pertemuan yang akan datang.
- Membatalkan mulai pertemuan tertentu atau seluruh pertemuan mendatang.
- Melihat laporan gabungan dan laporan masing-masing pertemuan.
- Memisahkan peserta, tiket, check-in, percakapan, dan laporan per pertemuan.
- Memberi tahu peserta melalui alur notifikasi acara yang sudah ada.

Pertemuan yang sudah selesai atau dimulai dalam waktu kurang dari dua jam tidak ikut diubah secara massal.

## Keamanan

- Tabel series memakai Row Level Security.
- Hak akses tabel dicabut dari public, anon, dan authenticated.
- Operasi hanya tersedia melalui fungsi yang memeriksa pengguna dan izin pengelolaan acara.
- Fungsi database mencabut akses default dari public dan anon.
- Identitas serta kontak pribadi peserta tidak masuk ke laporan gabungan.
- Jumlah pertemuan dibatasi maksimal 12.
- Setiap posisi pertemuan dalam satu rangkaian harus unik.
- Jika perubahan beberapa pertemuan berhenti di tengah proses, aplikasi memberi tahu jumlah pertemuan yang sudah berhasil diubah.

## Migrasi

Terapkan sesuai urutan:

1. `202610170002_event_series_v2.sql`
2. `202610170003_event_series_cancellation.sql`

Jangan menerapkan migrasi sebelum memastikan project Supabase yang terhubung benar-benar milik StudyDate.

## Aktivasi

1. Cocokkan riwayat migrasi lokal dan database tujuan.
2. Jalankan migrasi pada staging.
3. Jalankan test Event Series dan pemeriksaan advisor Supabase.
4. Uji dengan akun penyelenggara dan akun peserta.
5. Pastikan pembuatan, perubahan, pembatalan, pemberitahuan, serta laporan berjalan.
6. Atur `EVENT_SERIES_ENABLED=true` di staging.
7. Setelah lolos pengujian, terapkan langkah yang sama ke production.
8. Aktifkan flag production dan lakukan pemeriksaan singkat.

Jika migrasi belum diterapkan, biarkan `EVENT_SERIES_ENABLED=false`. Website tetap memakai acara biasa tanpa memanggil tabel Event Series.

## Skenario pengujian wajib

- Rangkaian mingguan tiga pertemuan.
- Rangkaian bulanan mulai tanggal 31.
- Mengubah satu pertemuan saja.
- Mengubah pertemuan ini dan setelahnya.
- Mengubah semua pertemuan yang akan datang.
- Mencoba mengubah pertemuan yang sudah selesai.
- Mencoba mengubah pertemuan kurang dari dua jam sebelum mulai.
- Membatalkan sesi berikutnya.
- Membatalkan seluruh sesi mendatang.
- Membuka laporan gabungan di layar mobile.
- Memastikan anggota tanpa izin tidak dapat mengubah rangkaian.
- Memastikan peserta tidak melihat identitas atau kontak peserta lain.

## Batasan saat ini

Event Series belum aktif di production sampai project Supabase StudyDate yang benar terhubung, migrasi berhasil diuji, dan feature flag diaktifkan. Tidak ada data contoh yang dibuat otomatis.
