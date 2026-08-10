# Account & Privacy Controls v1 — DEPLOYED / LIVE-VERIFIED

Deployed 10 Agustus 2026 ke project `ctbqudtvrfezuoqcecyj` melalui migrations
`202608100001`–`202608100003`. Post-deploy migration list sinkron dan dry-run
kosong. Audit sintetis exact-ID membuktikan settings/RLS, privacy lock,
Identity/Contact suppression, Storage/DB/Auth-last cleanup, tombstone
conversation/Circle/Event, retention, dan cleanup fixture. Browser audit
terautentikasi lulus pada 320, 375, 768, 1024, dan 1440 px.

Route utama: `/app/settings` dengan section Profil, Privasi, Blokir, dan Akun.
`/app/profile` redirect ke section Profil.

## Perilaku yang sudah ditentukan

- Alias anonim immutable.
- Editable: campus/program approved, degree, semester, general region, intro,
  interests, goals, official mascot, LinkedIn/Instagram private defaults, dan
  People discoverability.
- Discoverability OFF menghilangkan profile dari hasil/detail People baru,
  tanpa menghapus relationship, Circle/Event membership, atau completed reveal.
- Block list hanya blokir yang dibuat actor, dengan safe anonymous projection.
- Unblock tidak memulihkan Introduction, chat, Identity, atau Contact.
- Delete request idempotent dan irreversible melalui Student UI. Privacy lock
  langsung menutup seluruh normal social mutation melalui shared database
  eligibility guard; `pending` adalah antrean cleanup, bukan grace period.
- Cleanup tidak menghasilkan user notification.
- Student Verification tetap disabled.

## Final deletion policy

- Identity Reveal dan Contact Reveal milik akun langsung disembunyikan setelah
  privacy lock, kemudian data privat serta media miliknya dihapus.
- Riwayat bersama tetap utuh dengan identitas `Akun dihapus`; alias lama,
  profil, identitas reveal, dan kontak tidak diproyeksikan.
- Circle yang dimiliki diarsipkan. Event `scheduled` yang belum dimulai
  dibatalkan; Event historis dipertahankan.
- Bukti laporan aktif dipertahankan sampai kasus selesai. Setelah
  resolved/dismissed, bukti termininimasi dan audit keamanan tersanitasi
  disimpan maksimum 180 hari berdasarkan satu row `account_privacy_policy`.
- Auth user dihapus terakhir, setelah Storage dan database private cleanup.
- Tidak ada plaintext email tombstone atau mekanisme fingerprint lintas akun.
  Sistem suspensi lintas akun tetap future security work.

## Worker operasi

`npm run account-deletions:process -- --limit=10` menjalankan executor
server-only dengan `SUPABASE_SERVICE_ROLE_KEY`. Jalankan dari scheduler/runner
operasi tepercaya setelah deployment; browser tidak memicu worker.
Operasi terkontrol dapat memakai `--request-id=<uuid>`; nilai request internal
tidak boleh dicetak atau dikirim ke client.

Urutan per job:

1. `claim_account_deletion_job` mengambil lease 15 menit dengan `SKIP LOCKED`.
2. Worker meminta object refs milik target dari RPC service-only, lalu menghapus
   object per bucket dalam batch. Object yang sudah hilang aman untuk retry.
3. `cleanup_account_deletion_database` menerapkan kebijakan Circle/Event,
   mempertahankan hold moderasi, dan menghapus data Identity, Contact,
   Verification, serta default social yang privat.
4. Worker menghapus Auth user.
5. `complete_account_deletion_job` hanya berhasil bila cleanup database tercatat
   dan FK Auth telah mengosongkan `account_deletion_requests.user_id`.

Kegagalan memakai kategori tersanitasi, mempertahankan privacy lock, dapat
diklaim ulang, dan menghasilkan exit code gagal untuk scheduler.
`purge_expired_account_deletion_retention` serta
`purge_expired_account_deletion_requests` menjalankan cleanup retensi bounded
pada akhir setiap run.
