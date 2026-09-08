# Limited rollout plan — StudyDate core beta

Dokumen ini mengatur pengujian terbatas untuk alur inti StudyDate. Ini bukan daftar seluruh fitur yang ada di repository dan bukan bukti bahwa suatu environment sudah production-ready.

## Fokus MVP

- People Discovery
- Perkenalan
- Anonymous Chat
- Kenal Lebih Jauh
- Identity Reveal
- Contact Reveal untuk Telegram, Instagram, dan LinkedIn
- Block, report, account privacy, dan account deletion
- Early Access moderation, revision, invitation, claim, dan onboarding

Study Circle dan Campus Events adalah lapisan pertumbuhan. Keduanya boleh diuji pada cohort yang sama hanya setelah release gate masing-masing selesai. Telegram Companion dan checkout AutoGoPay adalah fitur terkontrol dan tetap OFF sampai remote migration, secret, webhook atau scheduler, serta live audit yang relevan sudah diverifikasi.

## Bahasa status

- **Repository implemented:** code atau migration tersedia di repository.
- **Remote rollout verified:** migration, konfigurasi, dan alur langsung sudah diperiksa pada environment tujuan.
- **Not implemented:** belum tersedia sebagai capability produk.

Jangan menyebut fitur live hanya karena source code atau migration-nya ada.

## Entry criteria

1. Commit release candidate sudah melewati lint, typecheck, test yang relevan, dan production build.
2. Remote migration list cocok dengan capability yang akan diuji.
3. Magic link, callback, rate limit, RLS dua akun, dan sign-out sudah diperiksa pada environment tujuan.
4. Owner dapat memproses Early Access: approve, minta perbaikan, reject, kirim ulang undangan, dan claim.
5. Block/report, moderation evidence, serta account deletion worker memiliki jalur operasional yang jelas.
6. Tidak ada user, statistik, testimoni, badge verifikasi, atau status keaktifan fiktif di UI publik.

## Cohort

- Mulai dari cohort kecil yang dapat dipantau oleh Owner.
- Tambah peserta bertahap setelah tidak ada insiden keamanan terbuka dan golden path stabil.
- Student Verification tetap OFF kecuali ada rollout terpisah yang disetujui.
- Plus atau pembayaran tidak menjadi syarat untuk mengikuti pengujian keamanan dan privasi.

## Golden path

1. Pendaftar mengisi Early Access.
2. Reviewer menyetujui, meminta perbaikan, atau menolak dengan alasan yang sesuai.
3. Pendaftar yang diminta memperbaiki memakai tautan sekali pakai lalu kembali ke queue.
4. Pendaftar yang disetujui menerima undangan, login dengan email yang sama, claim, dan menyelesaikan onboarding.
5. Mahasiswa menemukan profil anonim dan mengirim perkenalan.
6. Penerima menerima perkenalan lalu kedua pihak mulai chat.
7. Kedua pihak memilih Kenal Lebih Jauh, menyiapkan identitas, dan menyetujui reveal.
8. Kontak dibagikan per jenis dengan persetujuan terpisah.
9. Block, report, end conversation, privacy lock, dan account deletion diuji sebagai jalur utama, bukan tambahan.

## Operasional dan pengukuran

Pantau onboarding completion, kualitas perkenalan, reply rate, report handling, reveal yang dikendalikan pengguna, retensi sehat, serta kegagalan delivery. Simpan hanya data yang diperlukan dan jangan mempublikasikan angka yang belum disetujui.

Stop atau rollback rollout bila ada kebocoran identitas/kontak, bypass consent, block yang gagal, akses lintas akun, atau jalur penghapusan data yang tidak bekerja.

## Di luar core beta

- recommendation algorithm atau swipe UI
- attachment, call, live location, dan pertemuan di lokasi pribadi
- push, SMS, WhatsApp, atau native notifications
- Telegram Companion tanpa release gate terpisah
- pembayaran AutoGoPay tanpa rotated secret dan audit pembayaran langsung
- klaim production-ready yang hanya didasarkan pada source repository

## Exit criteria

Core beta dapat diperluas setelah golden path stabil, temuan keamanan prioritas tinggi selesai, operasi moderasi dapat ditangani, account deletion teruji, dan semua capability yang diumumkan sesuai dengan status environment sebenarnya.
