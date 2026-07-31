# StudyDate ID — Design Direction

## 1. Brand

- Name: StudyDate ID
- Tagline: MEET • CONNECT • GROW
- Fusion Blue (current `brand.blue` token): `#014FE7`
- Deep Navy: `#0F1B33`
- White: `#FFFFFF`

Gunakan aset resmi. Jangan redraw logo dari screenshot dan jangan mengubah proporsi symbol.

## 2. Visual direction

StudyDate harus terasa modern, editorial, campus-oriented, calm, private, trustworthy, dan social tanpa terlihat seperti
dating app.

Keyword: **editorial campus-tech**.

## 3. Hindari

- generic SaaS template;
- dashboard overload;
- excessive cards;
- exaggerated gradients;
- glassmorphism everywhere;
- fake charts/statistics;
- fake compatibility percentage;
- swipe decks;
- heart-heavy dating UI;
- purple AI aesthetic;
- excessive pills;
- random illustration styles.

## 4. Typography and layout

Gunakan Poppins untuk heading dan Inter untuk body/UI sesuai konfigurasi project saat ini. Pertahankan headline
editorial yang kuat, body copy yang nyaman, eyebrow yang restrained, dan hindari text terlalu kecil atau manual line
breaks berlebihan.

Desktop: generous whitespace, asymmetric editorial grids, first viewport menampilkan primary action.

Mobile: single-column, touch target nyaman, dialog dapat scroll internal, dan tidak horizontal overflow.

## 5. Landing page frozen

Struktur yang telah disetujui:
1. Navbar
2. Hero
3. People, Groups, Events
4. Introduction-before-chat
5. Progressive privacy
6. Groups
7. Campus Events
8. Online-first
9. Offline safety
10. Early Access CTA
11. Footer

Jangan redesign tanpa approval eksplisit.

## 6. Hero

Approved: large editorial headline, blue emphasis, anonymous profile visual, dua CTA, dan balanced first viewport.

Jangan mendorong konten terlalu jauh dari navbar, mengecilkan headline agresif, atau menyembunyikan CTA di bawah fold.

## 7. Privacy section

Approved: navy background, large white message, anonymous-chat mockup, dan mascot resmi dekat mockup. Mascot
disembunyikan pada mobile kecil dan tidak boleh terlihat seperti icon kecil yang nyasar.

## 8. Offline safety section

Public landing page menggunakan copy ringkas:
- title: “Bertemu di tempat umum”;
- pilih lokasi ramai, terang, mudah diakses, dan masih beroperasi;
- note: lokasi pribadi tidak diperbolehkan.

Jangan tampilkan daftar panjang lokasi terlarang pada landing page.

## 9. Authentication UI

Login harus calm, focused, branded, tidak ramai, dan tidak terlihat seperti generic admin login.

Wajib: email field jelas, loading, resend cooldown, generic error, keyboard support, dan readable success state.

## 10. Onboarding UI

Empat langkah: basic introduction, interests/goals, comfort preferences, consent.

Gunakan progress yang jelas, no romantic pressure, no rigid compatibility scoring, privacy helper dekat sensitive input,
dan jangan meminta data tidak perlu.

## 11. Authenticated app

`/app` saat ini minimal. Boleh menampilkan private greeting, anonymous alias, real verification status, onboarding
state, Student Verification status/action, dan People/Groups/Events sebagai “Segera hadir”.

Jangan tampilkan fake feed, profile, message, event, group, badge, atau metrics.

### Student Verification Center

Gunakan utility copy dan struktur tiga langkah: Data akademik, Bukti kepemilikan, Persetujuan. Status:
“Belum terverifikasi”, “Sedang diperiksa”, “Perlu tindakan”, “Terverifikasi”,
“Data belum dapat diverifikasi”, dan “Kedaluwarsa”. Primary action: “Verifikasi Mahasiswa”.

Selalu jelaskan bahwa nama legal dan NIM tidak tampil pada profil publik, verifikasi bersifat opsional, PDDikti match
saja tidak membuktikan kepemilikan, dan badge tidak menjamin perilaku. Gunakan existing app tokens, visible focus,
single-column mobile flow, dan status announcement; jangan membuat admin dashboard publik.

## 12. Components

Gunakan primitive yang sudah ada di `components/ui/`: button, input, card, checkbox, dropdown menu, dan label.
Early Access memakai dialog aksesibel di `components/marketing/early-access-dialog.tsx`. Gunakan Lucide untuk icon
dan token typography yang ada. Jangan menambah UI library untuk satu komponen.

## 13. Content style

Bahasa Indonesia yang natural, warm, respectful, clear, non-judgmental, dan tidak manipulatif.

Preferred:
- Kirim Perkenalan
- Kenal Lebih Jauh
- Tetap anonim dulu
- Bertemu di tempat umum
- Koneksi yang berarti

Avoid:
- Study Request
- Apply
- Match 98%
- Kamu ditolak
- Coba rayu lagi
- 100% aman
- Bukan dating app

## 14. Accessibility

Semantic heading, label, visible focus, keyboard flow, status announcement, error association, contrast, Escape/focus
restore, reduced motion, touch targets, dan no color-only meaning.

## 15. Responsive checkpoints

Periksa 375px, 768px, 1024px, 1440px, browser zoom, long Indonesian copy, errors, loading, empty states, dialog height,
dan horizontal overflow.
