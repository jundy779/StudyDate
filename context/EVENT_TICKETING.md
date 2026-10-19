# Tiket Acara

Paket ini menambahkan jenis tiket, kuota, jadwal penjualan, batas pembelian, kode akses atau promo, pesanan idempoten, dan fondasi pembayaran. Fitur sengaja tidak aktif otomatis.

## Kemampuan tahap 2

- Penyelenggara dapat membuat kode promo atau kode akses tanpa menyimpan kode mentah.
- Penyelenggara dapat melihat pesanan, tiket selesai, dan penjualan kotor tanpa melihat identitas pribadi pembeli.
- Peserta dapat membatalkan pesanan yang masih menunggu pembayaran.
- Pesanan kedaluwarsa melepas kembali kuota tiket dan jatah kode.
- Rekonsiliasi pembayaran bersifat idempoten dan hanya dapat dijalankan oleh service role.
- Adapter pembayaran gagal tertutup sampai satu penyedia dipilih dan diuji.

## Batas aman v1

- Harga disimpan sebagai rupiah bulat, bukan pecahan desimal.
- Kode akses tidak disimpan mentah. Aplikasi mengirim hash SHA-256 yang sudah dinormalisasi.
- Pesanan gratis langsung selesai. Pesanan berbayar berhenti di status `pending` sampai penyedia pembayaran dan webhook benar-benar siap.
- Payload webhook mentah, nomor kartu, rekening, dan rahasia pembayaran tidak disimpan.
- Tiket QR check-in yang sudah ada tetap menjadi bukti masuk. Modul ini mengurus pilihan tiket dan pesanan.

## Cara mengaktifkan

1. Pastikan target Supabase benar dan cocokkan riwayat migrasinya.
2. Terapkan `202610170004_event_ticketing_v1.sql`, lalu `202610190001_event_ticketing_operations.sql` di staging.
3. Jalankan database advisor, cek RLS, grant fungsi, pemesanan ganda, kuota serentak, dan kedaluwarsa pesanan.
4. Konfigurasikan cron kedaluwarsa pesanan dengan `CRON_SECRET`.
5. Atur `EVENT_TICKETING_ENABLED=true` hanya di staging.
6. Uji tiket gratis terlebih dahulu.
7. Sambungkan satu penyedia pembayaran, verifikasi tanda tangan webhook, dan lakukan rekonsiliasi sebelum tiket berbayar menerima uang sungguhan.
8. Setelah lolos, ulangi proses terkontrol di production.

Jika migrasi belum diterapkan, biarkan `EVENT_TICKETING_ENABLED=false`. Semua halaman dan panggilan database tiket baru tetap tersembunyi.
