# Tiket Acara

Paket ini menambahkan jenis tiket, kuota, jadwal penjualan, batas pembelian, kode akses atau promo, pesanan idempoten, dan fondasi pembayaran. Fitur sengaja tidak aktif otomatis.

## Batas aman v1

- Harga disimpan sebagai rupiah bulat, bukan pecahan desimal.
- Kode akses tidak disimpan mentah. Aplikasi mengirim hash SHA-256 yang sudah dinormalisasi.
- Pesanan gratis langsung selesai. Pesanan berbayar berhenti di status `pending` sampai penyedia pembayaran dan webhook benar-benar siap.
- Payload webhook mentah, nomor kartu, rekening, dan rahasia pembayaran tidak disimpan.
- Tiket QR check-in yang sudah ada tetap menjadi bukti masuk. Modul ini mengurus pilihan tiket dan pesanan.

## Cara mengaktifkan

1. Pastikan target Supabase benar dan cocokkan riwayat migrasinya.
2. Terapkan `202610170004_event_ticketing_v1.sql` di staging.
3. Jalankan database advisor, cek RLS, grant fungsi, pemesanan ganda, kuota serentak, dan kedaluwarsa pesanan.
4. Atur `EVENT_TICKETING_ENABLED=true` hanya di staging.
5. Uji tiket gratis terlebih dahulu.
6. Sambungkan satu penyedia pembayaran, verifikasi tanda tangan webhook, dan lakukan rekonsiliasi sebelum tiket berbayar menerima uang sungguhan.
7. Setelah lolos, ulangi proses terkontrol di production.

Jika migrasi belum diterapkan, biarkan `EVENT_TICKETING_ENABLED=false`. Semua halaman dan panggilan database tiket baru tetap tersembunyi.
