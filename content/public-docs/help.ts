import type { PublicDocSection } from "@/components/marketing/public-doc-article";

export const helpIntro =
  "Ringkasan cara kerja StudyDate ID. Untuk aturan lengkap, baca Kebijakan Privasi, Ketentuan, Pedoman Komunitas, dan Pusat Keamanan.";

export const helpSections: PublicDocSection[] = [
  {
    id: "apa-itu",
    title: "Apa itu StudyDate",
    blocks: [
      {
        type: "p",
        text: "StudyDate ID adalah platform koneksi mahasiswa untuk menemukan orang, Study Circle, dan Campus Events dengan konteks belajar dan kampus. Kamu mulai anonim, saling berkenalan, lalu membuka identitas dan kontak hanya jika keduanya setuju.",
      },
    ],
  },
  {
    id: "people",
    title: "Bagaimana People bekerja",
    blocks: [
      {
        type: "p",
        text: "Setelah masuk dan menyelesaikan onboarding, kamu dapat menelusuri profil anonim di People (jika mereka memilih dapat ditemukan). Filter membantu menyempitkan kampus, minat, atau tujuan koneksi. Detail memakai alias publik, bukan identitas lengkap.",
      },
    ],
  },
  {
    id: "perkenalan",
    title: "Bagaimana Perkenalan bekerja",
    blocks: [
      {
        type: "p",
        text: "Dari profil People, kirim pesan perkenalan singkat. Penerima dapat menerima, menolak, atau membiarkan kedaluwarsa. Ada batas frekuensi agar ruang tetap tenang. Penerimaan membuka jalur ke percakapan—bukan ke kontak.",
      },
    ],
  },
  {
    id: "chat",
    title: "Chat anonim",
    blocks: [
      {
        type: "p",
        text: "Setelah perkenalan diterima, kalian dapat berkirim pesan di Pesan. Kamu dapat mengakhiri percakapan, memblokir, atau melaporkan. Unread dihitung dari pesan yang belum kamu baca.",
      },
    ],
  },
  {
    id: "telegram-companion",
    title: "Telegram Companion",
    blocks: [
      {
        type: "p",
        text: "Dari Anonymous Chat yang masih aktif, kamu dapat memilih Lanjut di Telegram, membuka @StudyDateBot, lalu kembali ke StudyDate untuk mengonfirmasi koneksi. Bot hanya mendukung pesan teks dan satu percakapan aktif per akun pada v1.",
      },
      {
        type: "ul",
        items: [
          "Detail akun Telegram tidak ditampilkan kepada counterpart.",
          "Mutual Interest, Identity Reveal, Contact Reveal, dan pengaturan privasi tetap dilakukan di web StudyDate.",
          "Gunakan /unlink di bot atau Putuskan di Pengaturan untuk berhenti. Riwayat StudyDate tidak terhapus.",
          "Delivery Telegram dapat tertunda atau gagal; Anonymous Chat web tetap menjadi sumber riwayat.",
        ],
      },
    ],
  },
  {
    id: "mutual",
    title: "Mutual Interest",
    blocks: [
      {
        type: "p",
        text: "Di percakapan aktif, kalian dapat memilih “Kenal Lebih Jauh”. Pilihan satu pihak tetap privat sampai keduanya setuju. Mutual Interest tidak otomatis membuka nama, foto, atau kontak.",
      },
    ],
  },
  {
    id: "identity",
    title: "Identity Reveal",
    blocks: [
      {
        type: "p",
        text: "Setelah Mutual Interest, siapkan nama depan dan foto untuk percakapan itu, lalu setujui pembukaan bersama. Yang terbuka hanya nama depan dan foto yang disiapkan—bukan kontak atau dokumen.",
      },
    ],
  },
  {
    id: "contact",
    title: "Contact Reveal",
    blocks: [
      {
        type: "p",
        text: "Setelah Identity Reveal selesai, bagikan kontak per saluran: Telegram, Instagram, atau LinkedIn. Setiap saluran butuh persetujuan sendiri. WhatsApp, telepon, dan email tidak tersedia sebagai Contact Reveal saat ini.",
      },
    ],
  },
  {
    id: "blokir-lapor",
    title: "Blokir dan laporkan",
    blocks: [
      {
        type: "p",
        text: "Gunakan blokir untuk menghentikan interaksi. Gunakan laporkan untuk menandai pelanggaran Pedoman Komunitas. Staf dapat meninjau laporan melalui alur moderasi internal.",
      },
    ],
  },
  {
    id: "login",
    title: "Masuk dan masalah akun",
    blocks: [
      {
        type: "ul",
        items: [
          "Masuk lewat /login dengan Google atau tautan email StudyDate.",
          "Email yang didukung: @gmail.com, @vk.com, atau berakhiran .ac.id / .sch.id.",
          "Periksa folder spam jika email tautan belum muncul.",
          "Pastikan kamu membuka tautan di perangkat yang sama dengan yang kamu maksudkan untuk memakai sesi.",
          "Permintaan penghapusan akun tersedia di Pengaturan. Akun dan profil langsung dinonaktifkan, lalu penghapusan data privat diproses oleh sistem. Riwayat bersama yang perlu dipertahankan tampil sebagai “Akun dihapus”.",
        ],
      },
      {
        type: "note",
        text: "Verifikasi mahasiswa saat ini tidak tersedia secara global. Pada pengujian terkontrol, pengecekan akademik dapat memakai layanan pihak ketiga dan menyediakan fallback manual. Pencocokan data atau screenshot saja tidak membuat akun terverifikasi; bukti kepemilikan tetap wajib.",
      },
    ],
  },
  {
    id: "tautan",
    title: "Privasi dan keamanan",
    blocks: [
      {
        type: "ul",
        items: [
          "Kebijakan Privasi — /privacy",
          "Ketentuan Layanan — /terms",
          "Pedoman Komunitas — /community-guidelines",
          "Pusat Keamanan — /safety",
        ],
      },
    ],
  },
  {
    id: "dukungan",
    title: "Menghubungi dukungan",
    blocks: [
      {
        type: "p",
        text: "Email dukungan publik resmi domain studydate.id belum dipublikasikan di situs ini. Untuk pertanyaan umum sebelum punya akun, gunakan formulir Early Access di beranda. Untuk isu keamanan atau pelanggaran di dalam aplikasi, utamakan fitur laporkan. Pengguna yang sudah masuk dapat mengirim permintaan penghapusan dari Pengaturan.",
      },
    ],
  },
];
