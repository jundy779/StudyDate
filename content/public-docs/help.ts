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
        text: "StudyDate ID membantu mahasiswa dan alumni menemukan teman, circle belajar, dan acara kampus. Saat mulai kenalan, nama asli dan kontakmu belum ditampilkan. Kamu dapat membagikannya nanti jika kalian berdua setuju.",
      },
    ],
  },
  {
    id: "people",
    title: "Bagaimana Cari Teman bekerja",
    blocks: [
      {
        type: "p",
        text: "Setelah masuk dan menyelesaikan pengaturan awal, kamu dapat melihat profil di Cari Teman jika pemiliknya memilih untuk tampil. Gunakan pilihan kampus, minat, atau tujuan untuk menemukan orang yang lebih sesuai. Profil menampilkan nama samaran, bukan nama asli atau kontak.",
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
    title: "Ngobrol tanpa nama asli",
    blocks: [
      {
        type: "p",
        text: "Setelah perkenalan diterima, kalian dapat berkirim pesan. Kamu bisa mengakhiri percakapan, memblokir, atau melaporkan. Jumlah pesan yang belum dibaca akan terlihat di menu Pesan.",
      },
    ],
  },
  {
    id: "telegram-companion",
    title: "Lanjut ngobrol lewat Telegram",
    blocks: [
      {
        type: "p",
        text: "Jika fitur Telegram sudah tersedia untuk akunmu, pilih Lanjut di Telegram dari percakapan yang masih aktif. Buka @StudyDateBot, lalu kembali ke StudyDate untuk memastikan akun yang dihubungkan benar. Saat ini bot mendukung pesan teks dan satu percakapan aktif per akun.",
      },
      {
        type: "ul",
        items: [
          "Detail akun Telegram tidak ditampilkan kepada lawan bicara.",
          "Pilihan Kenal Lebih Jauh, pembukaan identitas, pembagian kontak, dan pengaturan privasi tetap dilakukan di web StudyDate.",
          "Gunakan /unlink di bot atau Putuskan di Pengaturan untuk berhenti. Riwayat StudyDate tidak terhapus.",
          "Pesan Telegram dapat terlambat atau gagal terkirim; riwayat utama tetap tersedia di web StudyDate.",
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
        text: "Gunakan Blokir untuk menghentikan interaksi. Pilih Laporkan jika ada pelanggaran Pedoman Komunitas. Laporan hanya dapat diperiksa oleh petugas yang berwenang.",
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
          "Masuk melalui halaman Masuk dengan Google atau tautan yang dikirim ke email.",
          "Email yang didukung: @gmail.com, @vk.com, atau berakhiran .ac.id / .sch.id.",
          "Periksa folder spam jika email tautan belum muncul.",
          "Pastikan kamu membuka tautan di perangkat yang sama dengan yang kamu maksudkan untuk memakai sesi.",
          "Permintaan penghapusan akun tersedia di Pengaturan. Akun dan profil langsung dinonaktifkan, lalu penghapusan data privat diproses oleh sistem. Riwayat bersama yang perlu dipertahankan tampil sebagai “Akun dihapus”.",
        ],
      },
      {
        type: "note",
        text: "Verifikasi mahasiswa belum dibuka untuk semua pengguna. Pada tahap uji terbatas, data akademik dapat diperiksa melalui layanan resmi atau oleh petugas. Data PDDikti atau tangkapan layar saja belum cukup; pengguna juga harus membuktikan bahwa akun kampus atau kartu mahasiswa tersebut benar miliknya.",
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
