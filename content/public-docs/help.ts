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
        text: "StudyDate ID adalah platform koneksi mahasiswa untuk menemukan teman, circle belajar, dan acara kampus dengan konteks belajar dan kampus. Kamu mulai anonim, saling berkenalan, lalu membuka identitas dan kontak hanya jika keduanya setuju.",
      },
    ],
  },
  {
    id: "people",
    title: "Bagaimana Cari Teman bekerja",
    blocks: [
      {
        type: "p",
        text: "Setelah masuk dan menyelesaikan onboarding, kamu dapat menelusuri profil anonim di Cari Teman (jika mereka memilih dapat ditemukan). Filter membantu menyempitkan kampus, minat, atau tujuan koneksi. Detail menampilkan nama samaran, bukan nama asli atau kontak.",
      },
    ],
  },
  {
    id: "perkenalan",
    title: "Bagaimana Perkenalan bekerja",
    blocks: [
      {
        type: "p",
        text: "Dari profil mahasiswa, kirim pesan perkenalan singkat. Penerima dapat menerima, menolak, atau membiarkan kedaluwarsa. Ada batas frekuensi agar ruang tetap tenang. Penerimaan membuka jalur ke percakapan—bukan ke kontak.",
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
        text: "Jika Telegram Companion sudah diaktifkan untuk akunmu, dari chat yang masih aktif kamu dapat memilih Lanjut di Telegram, membuka @StudyDateBot, lalu kembali ke StudyDate untuk mengonfirmasi koneksi. Bot hanya mendukung pesan teks dan satu percakapan aktif per akun pada v1.",
      },
      {
        type: "ul",
        items: [
          "Detail akun Telegram tidak ditampilkan kepada lawan bicara.",
          "Pilihan Kenal Lebih Jauh, pembukaan identitas, pembagian kontak, dan pengaturan privasi tetap dilakukan di web StudyDate.",
          "Gunakan /unlink di bot atau Putuskan di Pengaturan untuk berhenti. Riwayat StudyDate tidak terhapus.",
          "Pesan Telegram dapat tertunda atau gagal; chat di web StudyDate tetap menjadi sumber riwayat.",
        ],
      },
    ],
  },
  {
    id: "mutual",
    title: "Sama-sama ingin kenal lebih jauh",
    blocks: [
      {
        type: "p",
        text: "Di percakapan aktif, kalian dapat memilih “Kenal Lebih Jauh”. Pilihan satu pihak tetap privat sampai keduanya setuju. Pilihan bersama ini tidak otomatis membuka nama, foto, atau kontak.",
      },
    ],
  },
  {
    id: "identity",
    title: "Membuka identitas",
    blocks: [
      {
        type: "p",
        text: "Setelah kalian sama-sama memilih Kenal Lebih Jauh, siapkan nama depan dan foto untuk percakapan itu, lalu setujui pembukaan bersama. Yang terbuka hanya nama depan dan foto yang disiapkan—bukan kontak atau dokumen.",
      },
    ],
  },
  {
    id: "contact",
    title: "Membagikan kontak",
    blocks: [
      {
        type: "p",
        text: "Setelah identitas dibuka, bagikan kontak per saluran: Telegram, Instagram, atau LinkedIn. Setiap saluran butuh persetujuan sendiri. WhatsApp, telepon, dan email tidak tersedia untuk dibagikan melalui fitur ini saat ini.",
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
