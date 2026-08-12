# PDDIKTI Verification Provider v1

## Status

Migration database `202608110003` sudah **DEPLOYED** dan live-verified dengan
akun sintetis. Student Verification tetap dinonaktifkan secara global,
provider tetap disabled, controlled rollout belum dimulai, dan real provider
smoke belum dijalankan.

Provider berperan sebagai layanan pihak ketiga yang membantu academic match.
Provider bukan database authoritative StudyDate, bukan bukti kepemilikan
identitas, dan tidak dinyatakan sebagai API resmi pemerintah/PDDIKTI.

## Contract

- Method: `GET`
- Path konsep: `/api/tools/pddikti-mahasiswa`
- Parameter provider: `aksesKey` dan `query`
- Query StudyDate: NIM milik user authenticated yang sedang diverifikasi
- Environment server-only:
  - `PDDIKTI_LOOKUP_PROVIDER_ENABLED`
  - `PDDIKTI_PROVIDER_BASE_URL`
  - `PDDIKTI_PROVIDER_ACCESS_KEY`

Tidak ada variabel `NEXT_PUBLIC_*`. Access key tidak boleh dicatat ke log,
browser, URL StudyDate, analytics, atau source control. Kontrak provider yang
tersedia mewajibkan `aksesKey` pada query string tujuan provider; karena itu
operator wajib memastikan full outbound URL tidak dicatat oleh runtime,
proxy, APM, atau error reporting. Adapter tidak pernah menulis URL tersebut ke
log. Pengganti provider sebaiknya mendukung credential melalui header.

Lookup hanya dijalankan setelah user memberi consent eksplisit pada Verification
Center untuk mengirim NIM, nama legal, kampus, dan program yang mereka isi ke
layanan data akademik eksternal. Consent lookup ini terpisah dari consent
submission dan ownership proof.

## Matching

- NIM: trim, pertahankan leading zero, lalu gunakan normalisasi separator yang
  sama dengan verifikasi existing.
- Nama, kampus, dan program: Unicode NFKC, trim, collapse whitespace, lalu
  perbandingan case-insensitive.
- Auto-match hanya bila NIM, nama legal, kampus, dan program cocok exact setelah
  normalisasi.
- Seluruh candidate diperiksa; hasil pertama tidak dipercaya.
- Candidate yang tidak terkait dibuang dan tidak dipersist atau dikirim ke
  browser.

Outcome internal: `academic_match`, `not_found`, `mismatch`,
`provider_unavailable`, dan `provider_invalid_response`. Gangguan provider tidak
menjadi academic rejection.

## Timeout, retry, dan rate limit

- Timeout: 5 detik per attempt.
- Maksimal dua attempt; retry hanya untuk gangguan network, timeout, HTTP 429,
  atau HTTP 5xx.
- Response dibatasi 256 KB dan maksimal 50 candidate.
- Lookup: 3/account/jam dan 6/account/hari.
- Submission manual/ownership: 2/account/hari.
- Counter memakai durable server-side `api_rate_limits`; production gagal
  tertutup bila counter tidak tersedia.

## Fallback dan evidence

`not_found`, `mismatch`, dan provider unavailable dapat diteruskan ke manual
academic review. Screenshot PDDIKTI hanya supporting evidence untuk academic
match. Screenshot tidak membuktikan kepemilikan akun.

Evidence memakai bucket privat `student-verification-evidence`, random object
name, JPEG/PNG/WebP input maksimal 5 MB dan 4096×4096, decode ketat, auto-orient,
re-encode JPEG, serta metadata stripping. Reviewer mengakses evidence lewat
authenticated no-store media proxy; Storage path dan signed URL tidak dikirim ke
browser normal.

## Verification rule

`academic_match = approved` + `ownership_proof = approved` diperlukan untuk
badge. Provider match atau approval screenshot saja tidak dapat membuat profile
verified. Ownership tetap memakai email kampus approved atau review kartu
mahasiswa existing.

## Retensi, deletion, dan disable

Provider response penuh tidak disimpan. Metadata minimum yang disimpan hanya
identifier provider generik, waktu pemeriksaan, outcome match, dan keyed claim
fingerprint. Account deletion worker existing menghapus request, encrypted
identity, metadata, dan object evidence sebelum Auth deletion.

Untuk mematikan provider, set `PDDIKTI_LOOKUP_PROVIDER_ENABLED=false`. Untuk
mematikan seluruh fitur, pertahankan `STUDENT_VERIFICATION_ENABLED=false`.

## Replacement

Business logic bergantung pada `AcademicLookupProvider`, bukan payload vendor.
Adapter pengganti harus menghasilkan safe result model yang sama, memakai exact
matching yang sama, dan lulus test provider/security existing.

## Controlled smoke

Automated test tidak melakukan network nyata. Setelah persetujuan Owner, operator
dapat menjalankan:

```text
npm run pddikti-provider:smoke -- <Owner-approved-query> [expected-nim]
```

Script hanya mencetak status, latency, candidate count, exact-match status, dan
schema validity. Script tidak mencetak key, request URL, candidate payload,
nama, atau NIM. Jangan menjalankan smoke tanpa query sintetis atau yang disetujui
Owner.
