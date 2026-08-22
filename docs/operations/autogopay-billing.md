# AutoGoPay Billing Runbook

Scope production hanya GoPay QRIS. OVO, ShopeePay, dan OrderKuota tidak digunakan.

## Secret dan kill switch

- Revoke key yang pernah dibagikan melalui chat.
- Buat key pengganti di dashboard AutoGoPay dan simpan hanya sebagai
  `AUTOGOPAY_API_KEY` di environment server.
- Set `AUTOGOPAY_ENABLED=false` selama migration, deploy, dan smoke test awal.
- Callback: `https://studydate.id/api/integrations/autogopay/webhook`.
- Aktifkan `AUTOGOPAY_ENABLED=true` hanya setelah callback HTTPS dan paket Owner siap.

Jangan menyalin nilai key ke issue, chat, log, commit, atau command history.

## Deploy terkontrol

1. Pastikan migration lokal/remote sinkron dan dry-run hanya menampilkan migration baru.
2. Jalankan lint, typecheck, seluruh test, build, dan secret scan.
3. Apply migration billing dan deploy aplikasi dalam maintenance window pendek;
   kontrak RPC package tidak kompatibel dengan aplikasi singleton lama.
4. Pasang secret yang sudah dirotasi secara out-of-band.
5. Pastikan ketiga package baru tetap nonaktif; migration sengaja fail-closed.
6. Aktifkan kill switch dan satu package saja untuk smoke test.
7. Lakukan satu transaksi paket tersebut.
8. Pastikan satu order menjadi `paid` dan satu entitlement Plus dibuat/diperpanjang.
9. Kirim ulang callback valid yang sama; hasil harus tetap satu entitlement extension.
10. Aktifkan package lain hanya setelah hasil cocok; matikan package dan kill switch
    bila rekonsiliasi berbeda.

Tidak ada browser polling agresif. Webhook adalah jalur finalisasi; tombol status hanya
rekonsiliasi manual.

Kill switch hanya menutup checkout baru. Webhook tetap harus menerima dan mengkredit
transaksi valid yang dibuat sebelum switch dimatikan. Status `cancelled` atau `expired`
tetap boleh menjadi `paid` jika callback valid terlambat datang.

## Batas v1

- Tidak ada refund, reversal, atau dispute automation. Jika provider mendukung reversal,
  tambahkan lifecycle order dan kebijakan koreksi entitlement sebelum mengaktifkannya.
- Order `creating` yang lebih lama dari dua menit ditandai gagal agar user dapat retry.
- Payment order dihapus saat profile deletion sesuai lifecycle Auth-last saat ini.
  Putuskan retensi finansial legal sebelum volume pembayaran nyata meningkat.
