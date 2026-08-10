# Public legal & safety pages (production readiness)

Intended production origin: `https://studydate.id`

## Public routes (no auth)

| Path | Purpose |
|------|---------|
| `/` | Homepage |
| `/privacy` | Kebijakan Privasi |
| `/terms` | Ketentuan Layanan |
| `/community-guidelines` | Pedoman Komunitas |
| `/safety` | Pusat Keamanan |
| `/help` | Bantuan |

Legacy Indonesian slugs redirect permanently to the English paths above (`/privasi` → `/privacy`, etc.).

## Google Search Console / OAuth readiness

- Homepage and Privacy Policy are public and linked from the footer.
- Stable URLs relative to `studydate.id` as listed above.
- `app/sitemap.ts` and `app/robots.ts` expose crawlable public docs; authenticated areas are disallowed in robots.
- Canonical / `metadataBase` follow `NEXT_PUBLIC_SITE_URL` when set (use `https://studydate.id` in production).
- Google Sign-In aktif melalui Supabase Auth; callback teknis provider tetap
  berakhir pada route StudyDate `/auth/callback`.
- Domain email student tetap dibatasi ke `@gmail.com`, `@vk.com`, `.ac.id`, dan
  `.sch.id`.

Jangan mengubah konfigurasi Google Cloud Console sebagai bagian dari commit
produk rutin; perubahan OAuth tetap operasi Owner yang terpisah.

## Support contact

No public support inbox is published on these pages until Owner designates an official `studydate.id` address. Help points to Early Access form and in-app report for now.

## Related product flags

- Student Verification remains globally disabled (`STUDENT_VERIFICATION_ENABLED` ≠ `true`).
- Contact Reveal channels: Telegram, Instagram, LinkedIn only.
