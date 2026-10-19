# Tiket Acara

Paket ini menyiapkan jenis tiket, kuota, pesanan, kode, serta fondasi pembayaran. Fitur sengaja tidak aktif otomatis. Jalur yang disiapkan untuk uji adalah satu tiket gratis publik atau dengan kode per peserta yang pendaftarannya sudah berstatus terkonfirmasi.

## Yang benar-benar tersedia untuk uji

- Penyelenggara membuat tiket gratis yang terbuka untuk semua, dengan kuota dan periode pengambilan.
- Penyelenggara bisa memperbarui nama, keterangan, dan kuota tiket, serta menjeda penjualan. Tiket gratis publik bisa dibuka kembali. Perubahan kuota di bawah tiket yang sudah dipesan ditolak oleh database. Tiket berbayar yang sedang dijual akan dijeda saat pengaturan disimpan dan perlu dibuka kembali melalui tombol khusus.
- Penyelenggara dapat membuat kode akses lalu membuka tiket gratis dengan kode. Peserta memasukkan kode saat mengambil tiket. Database memeriksa kode aktif, jangka waktu, batas pemakaian, kuota, dan pendaftaran peserta dalam satu transaksi. Pembatalan pendaftaran mengembalikan kuota tiket dan jumlah pemakaian kode.
- Peserta harus mendaftar ke acara melalui alur pendaftaran biasa terlebih dahulu. Setelah terkonfirmasi, ia dapat mengambil satu tiket gratis.
- Pesanan gratis langsung selesai. Membatalkan pendaftaran acara akan membatalkan pesanan tiket gratis dan mengembalikan kuotanya.
- Pengelola melihat pesanan tanpa nama asli atau kontak pembeli. Tahap 2 juga menyiapkan daftar kode dan pemantauan pesanan.
- Pada acara dengan jenis tiket yang sudah dibuka, QR masuk dan check-in manual baru tersedia setelah peserta punya pesanan tiket yang selesai. Acara tanpa jenis tiket yang dibuka tetap memakai alur pendaftaran biasa.

## Masih dikunci

- Tiket berbayar GoPay QRIS sudah punya jalur teknis terpisah, tetapi tetap terkunci sampai pengujian database, webhook, dan transaksi staging selesai. Undangan untuk akun tertentu, promo berbayar, dan refund otomatis belum siap untuk publik.
- Jumlah tiket per peserta masih satu. Pembelian beberapa tiket untuk teman belum tersedia karena pendaftaran acara terikat satu akun mahasiswa.

## Batas aman v1

- Harga disimpan sebagai rupiah bulat, bukan pecahan desimal.
- Kode akses tidak disimpan mentah. Aplikasi mengirim hash SHA-256 yang sudah dinormalisasi.
- Checkout berbayar butuh `EVENT_TICKET_PAYMENTS_ENABLED=true`, AutoGoPay aktif, dan `campus_event_payment_settings.is_enabled=true` di database. Default semuanya mati untuk tiket acara.
- Peserta bisa membatalkan QRIS yang masih menunggu pembayaran. Callback pembayaran yang datang terlambat tetap tercatat; jika kuota atau pendaftaran sudah berubah, pesanan harus diperiksa manual. Peserta diminta tidak membayar ulang.
- Payload webhook mentah, nomor kartu, rekening, dan rahasia pembayaran tidak disimpan.
- Tiket QR check-in yang sudah ada tetap menjadi bukti masuk. Modul ini mengurus pilihan tiket dan pesanan.

## Cara mengaktifkan

1. Pastikan target Supabase benar dan cocokkan riwayat migrasinya.
2. Terapkan `202610170004_event_ticketing_v1.sql`, `202610190001_event_ticketing_operations.sql`, `202610190002_event_ticket_admission.sql`, `202610190003_event_ticket_autogopay.sql`, `202610190004_event_ticket_admission_guard.sql`, lalu `202610190005_event_ticket_code_access.sql` di staging. Jangan mengubah migrasi lama jika ternyata sudah diterapkan; buat migrasi koreksi baru.
3. Jalankan database advisor, cek RLS, grant fungsi, pemesanan ganda, kuota serentak, pembatalan pendaftaran, dan kedaluwarsa pesanan. Cron kedaluwarsa belum perlu dinyalakan selama pesanan berbayar ditutup.
4. Atur `EVENT_TICKETING_ENABLED=true` hanya di staging.
5. Uji pendaftaran terkonfirmasi, tiket gratis, kode benar/salah/kedaluwarsa/habis, dua permintaan serentak untuk kode dan kuota, pembatalan RSVP, pengembalian kuota dan pemakaian kode, QR masuk, check-in manual, serta akses peserta lain. Pastikan acara tanpa tiket baru tetap berjalan seperti semula.
6. Untuk tiket berbayar, uji AutoGoPay GoPay QRIS dengan key server yang sudah aman: pembuatan pesanan, respons gagal/timeout, pembayaran, callback asli dan duplikat, nominal salah, pembayaran terlambat, serta pembatalan RSVP. Callback yang sama dipakai membership dan tiket, jadi uji keduanya.
7. Setelah hasil cocok, hidupkan `EVENT_TICKET_PAYMENTS_ENABLED=true` di staging dan ubah `campus_event_payment_settings.is_enabled` menjadi `true` di database staging. Uji lagi sebelum melakukan proses terkontrol di production.

Jika migrasi belum diterapkan, biarkan `EVENT_TICKETING_ENABLED=false`. Jangan menerapkan migrasi tanpa audit database yang benar: feature flag aplikasi tidak membatasi pemanggilan RPC database secara langsung setelah fungsi diberi izin `authenticated`.

