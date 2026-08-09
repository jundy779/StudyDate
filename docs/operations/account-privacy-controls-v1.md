# Account & Privacy Controls v1 — LOCAL-ONLY

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
- Delete request idempotent membuat privacy lock langsung dan menutup seluruh
  normal social mutation melalui shared database eligibility guard.
- Cleanup tidak menghasilkan user notification.
- Student Verification tetap disabled.

## OWNER POLICY DECISION REQUIRED

1. Durasi pending/grace/retention sebelum final cleanup.
2. Apakah completed Identity Reveal (first name/photo) tetap dapat diakses
   counterpart setelah deletion.
3. Apakah completed Contact Reveal (Telegram/Instagram/LinkedIn) tetap dapat
   diakses counterpart setelah deletion.
4. Retensi active reports, moderation evidence, dan sanitized audit events.
5. Tombstone/anonymization Anonymous Chat, Circle messages, dan Event history.
6. Circle milik user: archive otomatis atau policy lain.
7. Future Event terorganisasi user: cancel atau archive.
8. Kapan dan bagaimana Auth user, private verification records, Identity media,
   contact ciphertext/versions, waitlist/rate-limit remnants, dan Storage
   objects dibersihkan.

Tidak ada cleanup worker/service function pada migration v1. Setelah delapan
keputusan di atas disetujui, tambahkan forward-only migration dan worker
service-role yang idempotent, retryable, sanitized, dan tidak executable oleh
student.
