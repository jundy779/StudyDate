import type { PublicDocSection } from "@/components/marketing/public-doc-article";

export const safetyIntro =
  "Pusat Keamanan ini merangkum cara StudyDate menjaga ruang yang lebih tenang: mulai anonim, buka identitas perlahan, dan bertemu hanya di tempat umum bila kalian siap.";

export const safetySections: PublicDocSection[] = [
  {
    id: "anonim-dulu",
    title: "Prinsip anonymous-first",
    blocks: [
      {
        type: "p",
        text: "Di StudyDate, kamu mulai dari alias dan konteks kampus—bukan identitas lengkap. Percakapan dibuka setelah perkenalan diterima. Ini memberi ruang untuk saling mengenal tanpa terburu-buru.",
      },
    ],
  },
  {
    id: "reveal-bertahap",
    title: "Reveal identitas dan kontak secara bertahap",
    blocks: [
      {
        type: "ol",
        items: [
          "Mutual Interest — keduanya memilih “Kenal Lebih Jauh”.",
          "Identity Reveal — nama depan dan foto yang disiapkan, setelah persetujuan bersama.",
          "Contact Reveal — Telegram, Instagram, atau LinkedIn per saluran, dengan persetujuan terpisah.",
        ],
      },
      {
        type: "p",
        text: "Setiap tahap berdiri sendiri. Kamu boleh berhenti kapan saja.",
      },
    ],
  },
  {
    id: "jangan-tekan",
    title: "Jangan menekan orang lain untuk reveal",
    blocks: [
      {
        type: "p",
        text: "Persetujuan harus sukarela. Memaksa, mengancam, atau mengaitkan “kepercayaan” dengan pembukaan kontak adalah pelanggaran. Jika merasa tertekan, akhiri percakapan, blokir, dan laporkan.",
      },
    ],
  },
  {
    id: "lindungi-info",
    title: "Lindungi informasi pribadi",
    blocks: [
      {
        type: "ul",
        items: [
          "Jangan membagikan alamat rumah, lokasi real-time, atau data keuangan di chat.",
          "Hati-hati membagikan NIM, dokumen, atau tautan sensitif.",
          "Ingat: tangkapan layar dapat terjadi di luar kendali StudyDate.",
        ],
      },
    ],
  },
  {
    id: "blokir-lapor",
    title: "Blokir dan laporkan",
    blocks: [
      {
        type: "p",
        text: "Fitur blokir dan laporkan tersedia pada alur yang relevan (perkenalan dan percakapan). Gunakan bila ada pelecehan, scam, spam, atau tekanan reveal. Laporan ditinjau oleh staf yang berwenang sesuai kapasitas moderasi.",
      },
    ],
  },
  {
    id: "tanda-scam",
    title: "Tanda peringatan scam",
    blocks: [
      {
        type: "ul",
        items: [
          "Segera meminta uang, hadiah, atau transfer “biaya”.",
          "Mendesak pindah ke kanal lain sebelum kalian siap, lalu meminta data sensitif.",
          "Menawarkan peluang investasi atau pekerjaan yang terlalu mudah.",
          "Menekan agar membuka kontak atau bertemu di lokasi pribadi.",
          "Profil atau cerita yang tidak konsisten dan terburu-buru.",
        ],
      },
      {
        type: "p",
        text: "Jika ragu, perlambat. Tidak ada kewajiban membalas atau bertemu.",
      },
    ],
  },
  {
    id: "keamanan-akun",
    title: "Dasar keamanan akun",
    blocks: [
      {
        type: "ul",
        items: [
          "Amankan email yang dipakai untuk tautan masuk StudyDate.",
          "Jangan meneruskan tautan masuk kepada orang lain.",
          "Keluar dari perangkat bersama setelah selesai.",
          "Laporkan aktivitas mencurigakan pada akunmu melalui Bantuan bila perlu.",
        ],
      },
    ],
  },
  {
    id: "bertemu-offline",
    title: "Bertemu offline hanya jika keduanya setuju",
    blocks: [
      {
        type: "p",
        text: "Pertemuan dunia nyata bersifat opsional. Lanjutkan hanya jika keduanya nyaman, sudah berinteraksi cukup online, dan setuju pada waktu serta tempat umum.",
      },
    ],
  },
  {
    id: "tempat-umum",
    title: "Tempat yang disarankan",
    blocks: [
      {
        type: "p",
        text: "Pilih lokasi ramai, terang, mudah diakses, dan masih beroperasi, misalnya:",
      },
      {
        type: "ul",
        items: [
          "Kafe",
          "Perpustakaan",
          "Coworking space",
          "Area kampus yang terbuka untuk umum atau area publik kampus yang ramai",
        ],
      },
    ],
  },
  {
    id: "hindari-pribadi",
    title: "Lokasi yang dihindari",
    blocks: [
      {
        type: "p",
        text: "Hindari pertemuan di rumah pribadi, kos atau kamar pribadi, apartemen pribadi, dan kamar hotel. Lokasi sepi atau tertutup meningkatkan risiko dan tidak didukung sebagai pilihan platform.",
      },
    ],
  },
  {
    id: "rencana-aman",
    title: "Rencana aman sebelum bertemu",
    blocks: [
      {
        type: "ul",
        items: [
          "Beritahu orang yang kamu percaya ke mana kamu pergi dan kapan perkiraan selesai.",
          "Atur transportasi sendiri bila memungkinkan.",
          "Tetap di area publik selama pertemuan.",
          "Jika merasa tidak nyaman, kamu berhak meninggalkan tempat itu kapan saja—tanpa perlu menjelaskan panjang.",
        ],
      },
      {
        type: "note",
        text: "StudyDate tidak menyediakan layanan darurat. Dalam situasi berbahaya, hubungi pihak berwenang atau layanan darurat setempat.",
      },
    ],
  },
];
