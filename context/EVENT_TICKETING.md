# Tiket Acara

Paket ini menyiapkan jenis tiket, kuota, pesanan, kode, serta fondasi pembayaran. Fitur sengaja tidak aktif otomatis. Saat ini jalur yang layak diuji hanya satu tiket gratis per peserta yang pendaftarannya sudah berstatus terkonfirmasi.

## Yang benar-benar tersedia untuk uji

- Penyelenggara membuat tiket gratis yang terbuka untuk semua, dengan kuota dan periode pengambilan.
- Peserta harus mendaftar ke acara melalui alur pendaftaran biasa terlebih dahulu. Setelah terkonfirmasi, ia dapat mengambil satu tiket gratis.
- Pesanan gratis langsung selesai. Membatalkan pendaftaran acara akan membatalkan pesanan tiket gratis dan mengembalikan kuotanya.
- Pengelola melihat pesanan tanpa nama asli atau kontak pembeli. Tahap 2 juga menyiapkan daftar kode dan pemantauan pesanan.
- Pada acara dengan jenis tiket yang sudah dibuka, QR masuk dan check-in manual baru tersedia setelah peserta punya pesanan tiket yang selesai. Acara tanpa jenis tiket yang dibuka tetap memakai alur pendaftaran biasa.

## Masih dikunci

- Tiket berbayar, kode akses untuk tiket privat, undangan, checkout, webhook gateway, refund, dan pembayaran sungguhan belum siap untuk publik. Jenis tiket ini hanya dapat disimpan sebagai rancangan.
- Kode promo/akses dapat dipersiapkan, tetapi tidak dipromosikan sebagai fitur aktif sampai alur berbayar dan privat diuji.
- Jumlah tiket per peserta masih satu. Pembelian beberapa tiket untuk teman belum tersedia karena pendaftaran acara terikat satu akun mahasiswa.

## Batas aman v1

- Harga disimpan sebagai rupiah bulat, bukan pecahan desimal.
- Kode akses tidak disimpan mentah. Aplikasi mengirim hash SHA-256 yang sudah dinormalisasi.
- Pesanan berbayar ditolak di database. Tidak ada pembayaran yang diproses.
- Payload webhook mentah, nomor kartu, rekening, dan rahasia pembayaran tidak disimpan.
- Tiket QR check-in yang sudah ada tetap menjadi bukti masuk. Modul ini mengurus pilihan tiket dan pesanan.

## Cara mengaktifkan

1. Pastikan target Supabase benar dan cocokkan riwayat migrasinya.
2. Terapkan `202610170004_event_ticketing_v1.sql`, `202610190001_event_ticketing_operations.sql`, lalu `202610190002_event_ticket_admission.sql` di staging. Jangan mengubah migrasi lama jika ternyata sudah diterapkan; buat migrasi koreksi baru.
3. Jalankan database advisor, cek RLS, grant fungsi, pemesanan ganda, kuota serentak, pembatalan pendaftaran, dan kedaluwarsa pesanan. Cron kedaluwarsa belum perlu dinyalakan selama pesanan berbayar ditutup.
4. Atur `EVENT_TICKETING_ENABLED=true` hanya di staging.
5. Uji pendaftaran terkonfirmasi, tiket gratis, dua permintaan serentak, pembatalan RSVP, pengembalian kuota, QR masuk, check-in manual, dan akses peserta lain. Pastikan acara tanpa tiket baru tetap berjalan seperti semula.
6. Sambungkan satu penyedia pembayaran dalam perubahan terpisah, verifikasi tanda tangan webhook serta nominal transaksi sebelum tiket berbayar dapat dibuka.
7. Setelah lolos, ulangi proses terkontrol di production.

Jika migrasi belum diterapkan, biarkan `EVENT_TICKETING_ENABLED=false`. Jangan menerapkan migrasi tanpa audit database yang benar: feature flag aplikasi tidak membatasi pemanggilan RPC database secara langsung setelah fungsi diberi izin `authenticated`.
