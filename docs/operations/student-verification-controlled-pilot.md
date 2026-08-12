# Student Verification controlled pilot

## Scope

Pilot awal hanya untuk UUID mahasiswa pada
`STUDENT_VERIFICATION_TEST_USER_IDS`. Flag global dan provider tetap `false`.
Badge selalu memerlukan keputusan akhir reviewer aktif setelah academic match
dan ownership proof selesai. Status akademik provider hanya metadata untuk
reviewer, bukan keputusan otomatis.

## Entry gate

1. Migration `202608120001` sudah diterapkan pada project
   `ctbqudtvrfezuoqcecyj` setelah dry-run dan approval Owner.
2. Encryption/HMAC key terpisah, reviewer dedicated aktif, bucket privat benar.
3. Vercel Cron cleanup sudah berhasil dan heartbeat berumur kurang dari 36 jam
   dengan failed/remaining count nol.
4. `npm run check`, `npm run test:verification`, dan `npm run test:pddikti`
   lulus.
5. `npm run test:verification:live` lulus tanpa provider call.

## Fase

1. Manual student-card allowlist, provider dan email kampus OFF.
2. Email kampus hanya setelah delivery sink dan domain cohort disetujui; email
   confirmation tetap menunggu finalisasi staff.
3. Provider hanya setelah key dirotasi dan satu structural smoke Owner-approved
   menghasilkan schema valid. Global flag tetap OFF.
4. Global enable merupakan keputusan terpisah setelah pilot dan dokumen publik
   diperbarui.

## Containment

- Provider incident: set `PDDIKTI_LOOKUP_PROVIDER_ENABLED=false`, redeploy,
  pertahankan manual lane bila readiness sehat.
- Verification incident: set `STUDENT_VERIFICATION_ENABLED=false`, kosongkan
  allowlist, redeploy; cleanup tetap berjalan.
- Badge salah: reviewer memakai action invalidation. Jangan direct-update
  `profiles` atau menghapus evidence.

## Dilarang

- Jangan log URL provider, query, credential, NIM, nama, email, UUID, path
  Storage, payload, atau candidate.
- Jangan merotasi encryption/HMAC key sebagai rollback.
- Jangan menjalankan migration remote, fixture live, atau provider smoke tanpa
  approval eksplisit.
