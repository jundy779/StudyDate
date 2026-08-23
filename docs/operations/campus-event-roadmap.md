# Campus Event roadmap — controlled rollout

Status: migration `202608210003`–`202608210010` sudah deployed dan remote lint
bersih. Scheduler tetap OFF sampai live QA dan approval aktivasi terpisah.

## Urutan

1. Pastikan remote sudah memuat `202608170006`, lalu rencanakan `202608210001`
   sampai `202608210010` tanpa melompati dependency.
2. Jalankan lint, typecheck, `test:events`, `test:notifications`, dan build.
3. Jalankan `supabase db push --linked --dry-run` memakai profile `studydate`.
4. Tinjau exact pending set. Hentikan bila project ref bukan
   `ctbqudtvrfezuoqcecyj` atau ada migration tak terduga.
5. Minta approval eksplisit sebelum apply.

## Scheduler

Migration hanya membuat `product_scheduler_tick()` dan grant `service_role`.
Aktivasi dilakukan setelah live audit:

```sql
select cron.schedule(
  'studydate-product-scheduler-v1',
  '*/15 * * * *',
  $$select public.product_scheduler_tick();$$
);
```

Rollback behavior:

```sql
select cron.unschedule('studydate-product-scheduler-v1');
```

Pantau `product_scheduler_runs.last_succeeded_at`; anggap unhealthy bila lebih
dari 45 menit tanpa sukses. Jangan menambah Vercel Cron kedua.

## Semantik data

- Waitlist FIFO memakai `(joined_at, user_id)`, mengisi slot saat RSVP batal
  atau kapasitas naik, dan membatalkan antrean aktif saat Event ditutup.
- Event Chat hanya untuk organizer/RSVP aktif. Report pesan menyimpan excerpt
  immutable maksimal 280 karakter ke Moderation Triage yang sudah ada.
- Ticket menyimpan hash token saja. Raw token direkonstruksi hanya server-side
  untuk pemilik registrasi agar QR tetap tersedia setelah reload; RSVP/Event
  cancellation mencabut ticket. Check-in bukan location tracking atau bukti
  keselamatan.
- Notification preference hanya mengendalikan in-app delivery pada v1.

## Live verification minimum

- Free/Plus quota dan dua sesi RSVP bersamaan.
- Waitlist: kandidat quota-full dilewati, kandidat berikut dipromosikan.
- Preference OFF pada single, fan-out, reminder, dan waitlist notification.
- Event Chat: send/list/report serta account deletion lock.
- Ticket: issue, refresh state, cancel RSVP, re-RSVP/reissue, duplicate check-in.
- Scheduler dua tick berulang tanpa duplicate receipt.

Tidak ada synthetic production data tanpa persetujuan Owner. Bersihkan data QA
setelah verifikasi dan jangan mencatat email, UUID, token ticket, atau secret.
