# AutoGoPay Billing Runbook

Scope production hanya GoPay QRIS. OVO, ShopeePay, dan OrderKuota tidak digunakan.

## Secret dan kill switch

- Revoke key yang pernah dibagikan melalui chat.
- Buat key pengganti di dashboard AutoGoPay dan simpan hanya sebagai
  `AUTOGOPAY_API_KEY` di environment server.
- Set `AUTOGOPAY_ENABLED=false` selama migration, deploy, dan smoke test awal.
- Callback: `https://studydate.id/api/integrations/autogopay/webhook`.
- Aktifkan `AUTOGOPAY_ENABLED=true` hanya setelah callback HTTPS dan offer Owner siap.

Jangan menyalin nilai key ke issue, chat, log, commit, atau command history.

## Deploy terkontrol

1. Pastikan migration lokal/remote sinkron dan dry-run hanya menampilkan migration baru.
2. Jalankan lint, typecheck, seluruh test, build, dan secret scan.
3. Apply migration billing sebelum deploy aplikasi yang memanggil RPC baru.
4. Pasang secret yang sudah dirotasi secara out-of-band.
5. Deploy dengan kill switch OFF, lalu simpan offer Owner dalam keadaan nonaktif.
6. Aktifkan kill switch dan offer.
7. Lakukan satu transaksi nominal kecil.
8. Pastikan satu order menjadi `paid` dan satu entitlement Plus dibuat/diperpanjang.
9. Kirim ulang callback valid yang sama; hasil harus tetap satu entitlement extension.
10. Matikan offer dan kill switch bila rekonsiliasi berbeda.

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
