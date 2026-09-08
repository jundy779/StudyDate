# Roadmap Aplikasi Mobile StudyDate ID

Status: rencana jangka menengah  
Diperbarui: 8 September 2026

## Keputusan stack

Gunakan satu aplikasi **Expo + React Native + TypeScript** untuk Android dan iOS. Fondasi sudah tersedia di folder `mobile/`, jadi tidak perlu membuat dua aplikasi terpisah.

| Bagian | Teknologi | Pengguna |
|---|---|---|
| Landing page, Akses Awal, Admin, Owner | Next.js | Publik dan tim operasional |
| Aplikasi utama | Expo + React Native | Mahasiswa dan alumni |
| Data, autentikasi, aturan akses | Supabase + API/RPC terversi | Web, mobile, dan bot |
| Pendamping cepat | Bot Telegram | Mahasiswa dan alumni |

Admin dan Owner tetap di web pada tahap awal. Layar kerja dan pemeriksaan data lebih nyaman di desktop.

## Prinsip arsitektur

- Web, mobile, dan Telegram memakai satu akun serta sumber data.
- Aturan penting dijalankan di server atau RPC.
- Kunci `service_role` tidak pernah masuk ke aplikasi mobile.
- Kontrak data dibuat terversi agar aplikasi lama tidak rusak saat web berubah.
- Telegram, email, dan QR memakai deep link ke tujuan yang sama.
- Peluncuran bertahap memakai feature flag.

## Tahapan pengerjaan

### 0. Arah produk dan web

Selesai jika bahasa publik, mahasiswa, Admin, dan Owner konsisten; pesan utama menjelaskan teman, circle, serta acara; hubungan romantis tetap mungkin tanpa menjadi pesan utama; dan web menjadi acuan mobile.

### 1. Fondasi aplikasi

Kerjakan Expo Router, environment, login email, penyimpanan sesi yang aman, design tokens, komponen dasar, deep link, kondisi loading/error/offline, serta analytics minimum tanpa isi percakapan atau data pribadi.

Selesai jika pengguna dapat masuk, keluar, memulihkan sesi, dan berpindah layar secara konsisten di Android dan iOS.

### 2. Alur utama koneksi

Kerjakan Beranda, Cari Teman, perkenalan, percakapan anonim, minat bersama, buka identitas/kontak dengan persetujuan, blokir, dan laporkan.

Selesai jika dua akun uji dapat menyelesaikan alur tanpa membuka data yang belum disetujui.

### 3. Circle dan acara

Kerjakan Circle Belajar, diskusi, Acara Kampus, pendaftaran, daftar tunggu, tiket, QR check-in, notifikasi perangkat, dan pengisian manual jika kamera gagal.

Selesai jika pengguna dapat menemukan kegiatan, mendaftar, hadir, dan memulai perkenalan dari konteks tersebut.

### 4. Telegram sebagai pendamping

Kerjakan penghubungan akun lewat web, pencarian ringan, notifikasi aman, deep link, putuskan akun, pembatasan penggunaan, audit, dan pemulihan kegagalan kirim.

Telegram bukan backend terpisah. Bot memakai aturan izin dan privasi yang sama dengan web dan mobile.

### 5. StudyDate Plus dan kesiapan toko

Kerjakan Apple In-App Purchase, Google Play Billing, pemulihan pembelian, status paket dari server, halaman privasi/syarat/dukungan/penghapusan akun, moderasi, serta Sign in with Apple bila login pihak ketiga yang setara tersedia di iOS.

Tiket acara fisik dapat memakai pembayaran di luar store. Fitur digital dan StudyDate Plus mengikuti pembayaran store.

### 6. Uji dan rilis bertahap

1. Internal build.
2. Uji akun sintetis.
3. Closed beta kampus terbatas.
4. Perbaiki crash, privasi, dan alur inti.
5. Rilis produksi bertahap.
6. Perluas kampus berdasarkan retensi dan keamanan.

## Persyaratan store

Ketentuan dapat berubah; periksa lagi sebelum mengirim build.

- Mulai 31 Agustus 2026, aplikasi baru dan pembaruan Google Play harus menargetkan Android 16 / API 36.
- Akun Google Play pribadi baru biasanya perlu closed test sedikitnya 12 penguji selama 14 hari berturut-turut.
- Google Play Console: biaya pendaftaran sekali USD 25.
- Apple Developer Program: USD 99 per tahun; akun organisasi memerlukan badan hukum dan D-U-N-S Number.
- Konten buatan pengguna memerlukan penyaringan, pelaporan, pemblokiran, moderasi, dan kontak dukungan.
- Penghapusan akun tersedia di aplikasi; Google juga meminta tautan web.
- Jika login pihak ketiga tersedia di iOS, sediakan opsi setara sesuai ketentuan privasi Apple.
- Nama, deskripsi, screenshot, dan kategori tidak boleh membuat StudyDate ID terlihat seperti aplikasi kencan generik.

## Sumber resmi

- Expo EAS: https://docs.expo.dev/deploy/submit-to-app-stores/
- Target API: https://support.google.com/googleplay/android-developer/answer/11926878?hl=en
- Akun Play: https://support.google.com/googleplay/android-developer/answer/6112435?hl=en
- Closed test: https://support.google.com/googleplay/android-developer/answer/14151465?hl=en
- Pembayaran Play: https://support.google.com/googleplay/android-developer/answer/9858738?hl=en
- Hapus akun Play: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en
- App Review Apple: https://developer.apple.com/app-store/review/guidelines/
- Apple Developer: https://developer.apple.com/programs/enroll/
- Hapus akun Apple: https://developer.apple.com/support/offering-account-deletion-in-your-app/

## Keputusan sebelum fase aplikasi

- Gunakan akun store badan usaha untuk arah brand nasional.
- Tetapkan package identifier permanen, misalnya `id.studydate.app`.
- Siapkan email dukungan, bantuan, kebijakan privasi, dan proses moderasi.
- Pilih satu kampus atau kelompok kecil untuk closed beta pertama.
- Jangan memindahkan Admin dan Owner ke mobile sebelum ada kebutuhan nyata.
