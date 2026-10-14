# StudyDate Mobile

Satu aplikasi Expo + React Native + TypeScript untuk Android dan iOS. Dashboard
Admin dan Owner tetap berada di web.

## Status

Fondasi mobile tahap pertama sudah mencakup:

- routing terpisah untuk layar tamu dan layar yang membutuhkan sesi;
- masuk melalui magic link untuk akun yang sudah terdaftar;
- callback PKCE melalui `studydate://auth/callback`;
- pemulihan sesi saat aplikasi dibuka kembali;
- penyimpanan sesi terenkripsi dengan SecureStore;
- refresh token mengikuti status aktif aplikasi;
- pesan offline yang mudah dipahami;
- halaman Beranda dan Akun dasar;
- keluar akun;
- kondisi loading, konfigurasi belum lengkap, dan link kedaluwarsa.
- daftar Cari Teman dari RPC privacy-safe;
- pagination dan tarik untuk memuat ulang profil;
- pengecekan kelayakan sebelum mengirim perkenalan;
- penyaring nomor, email, username, dan tautan pada pesan pertama;
- daftar perkenalan masuk dan terkirim;
- terima, tolak, batalkan, lalu buka percakapan;
- daftar percakapan anonim dan jumlah pesan belum dibaca;
- pencarian percakapan berdasarkan nama samaran, kampus, atau program studi;
- filter semua, belum dibaca, aktif, dan selesai;
- ruang chat teks dengan pemuatan riwayat dan pembaruan berkala;
- balas pesan tanpa kehilangan konteks percakapan;
- lima reaksi emoji dengan jumlah reaksi dan penanda reaksimu;
- empat stiker resmi StudyDate dengan tampilan ringan untuk mobile;
- berbagi Circle belajar atau Event yang memang bisa diakses pengguna;
- pencarian isi pesan, balasan, dan kartu ajakan yang sudah dimuat;
- Jelajah Circle dan Acara dengan pencarian lokal;
- detail Circle, gabung, serta keluar Circle;
- daftar anggota dan obrolan Circle untuk anggota aktif;
- buat, ubah, tutup Circle, dan keluarkan anggota sebagai pengelola;
- detail Acara, formulir pertanyaan dinamis, status pendaftaran, dan pembatalan;
- status pesan dibaca serta perlindungan dari pesan ganda;
- akhiri percakapan, blokir akun, dan kirim laporan privat.

Pembuatan dan pengelolaan Event, push notification, kamera, dan billing belum
dianggap selesai hanya karena tab atau mockup
tersedia. Cari Teman, Perkenalan, chat teks,
balasan, reaksi, stiker, dan berbagi ajakan sudah memakai RPC asli, tetapi tetap harus lulus
pengujian dua akun pada project production yang benar sebelum disebut aktif penuh.

## Setup

```bash
npm install
copy .env.example .env.local
npm run typecheck
npm test
npm run doctor
```

Isi variabel berikut di `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_SITE_URL=https://studydate.id
```

Hanya publishable key yang boleh masuk aplikasi. Jangan pernah memasukkan
`service_role`, SMTP password, secret pembayaran, secret tiket, atau credential
server lainnya.

## Pengaturan Auth Supabase

Tambahkan URL berikut ke allowlist redirect Auth:

```text
studydate://auth/callback
```

Magic link mobile memakai `shouldCreateUser: false`. Pengguna baru tetap harus
melewati Akses Awal di website dan aplikasi mobile tidak dapat digunakan untuk
melewati persetujuan tersebut.

## Development

```bash
npm start
npm run android
npm run ios
```

Android dapat dijalankan dari Windows dengan Android Studio. Build iOS lokal
memerlukan macOS dan Xcode. Dari Windows, build iOS dapat dilakukan melalui EAS
setelah akun Apple dan signing tersedia.

## Verifikasi sebelum beta

```bash
npm run typecheck
npm run doctor
```

Lalu uji pada development build Android dan iOS:

1. Kirim magic link ke akun Early Access yang sudah disetujui.
2. Buka link dari perangkat yang sama.
3. Pastikan callback membuka aplikasi dan sesi pulih setelah aplikasi ditutup.
4. Pastikan email yang belum terdaftar tidak membuat akun baru.
5. Keluar dan pastikan layar yang membutuhkan sesi tidak dapat dibuka kembali.
6. Terima satu perkenalan dari akun kedua dan buka percakapannya.
7. Kirim pesan dari kedua akun, lalu pastikan status belum dibaca berubah.
8. Uji akhiri percakapan, laporan, dan blokir memakai akun khusus pengujian.

Pengujian login nyata membutuhkan konfigurasi redirect dan project Supabase
StudyDate yang benar. Pemeriksaan lokal tidak menggantikan pengujian tersebut.

## Store build

```bash
npx eas login
npx eas build:configure
npm run build:android
npm run build:ios
```

Submission tetap memerlukan listing store, deklarasi privasi, screenshot, akun
review, signing, moderasi konten pengguna, dan billing store untuk fitur digital
berbayar.
