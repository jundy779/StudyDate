import type { PublicDocSection } from "@/components/marketing/public-doc-article";

export const privacyIntro =
  "Kebijakan ini menjelaskan data yang digunakan StudyDate ID, alasan penggunaannya, dan cara kami menjaganya. Isinya mengikuti fitur yang benar-benar tersedia, bukan janji fitur yang belum aktif.";

export const privacySections: PublicDocSection[] = [
  {
    id: "ringkasan",
    title: "Ringkasan",
    blocks: [
      {
        type: "p",
        text: "StudyDate ID membantu mahasiswa berkenalan secara bertahap. Informasi yang terlihat orang lain dibatasi, sedangkan nama, foto, atau kontak baru dibagikan setelah kedua pihak setuju.",
      },
      {
        type: "ul",
        items: [
          "Masuk memakai tautan yang dikirim ke email, bukan kata sandi.",
          "Cari Teman menampilkan nama samaran dan informasi kampus yang kamu pilih, bukan nama asli atau kontak.",
          "Percakapan, pilihan Kenal Lebih Jauh, pembagian nama dan foto, serta pembagian kontak memiliki persetujuan masing-masing.",
          "Verifikasi mahasiswa belum dibuka untuk semua pengguna.",
        ],
      },
    ],
  },
  {
    id: "pengendali",
    title: "Siapa yang mengendalikan data",
    blocks: [
      {
        type: "p",
        text: "StudyDate ID menjalankan layanan melalui studydate.id. Untuk pertanyaan tentang privasi, gunakan halaman Bantuan. Alamat email dukungan resmi akan ditampilkan setelah saluran dukungan StudyDate tersedia.",
      },
    ],
  },
  {
    id: "akun-autentikasi",
    title: "Akun dan cara masuk",
    blocks: [
      {
        type: "p",
        text: "Untuk membuat atau membuka akun, kami menggunakan alamat email yang kamu masukkan dan mengirim tautan masuk bermerek StudyDate. Saat ini akun mahasiswa tidak memakai kata sandi StudyDate.",
      },
      {
        type: "ul",
        items: [
          "Data yang digunakan: email akun, status masuk, dan data teknis secukupnya untuk menjaga keamanan.",
          "Tujuan: memastikan pemilik akun, mencegah penyalahgunaan tautan masuk, dan membuka halaman yang sesuai.",
          "Kami tidak memublikasikan email akun ke pengguna lain.",
        ],
      },
    ],
  },
  {
    id: "onboarding-profil",
    title: "Pengaturan awal dan data profil",
    blocks: [
      {
        type: "p",
        text: "Saat mengatur profil untuk pertama kali, kamu dapat mengisi nama, kampus, program studi, jenjang, semester, wilayah umum, minat, dan tujuan mencari teman. Kamu juga diminta menyetujui Ketentuan, Privasi, dan Pedoman Komunitas. Nama lengkap disimpan secara privat; Cari Teman hanya menampilkan nama samaran.",
      },
      {
        type: "ul",
        items: [
          "NIM bersifat opsional. Jika diisi, disimpan secara terpisah dan terlindungi, bukan bagian dari profil publik.",
          "Kami tidak meminta nomor telepon, alamat rumah, lokasi tepat, atau dokumen identitas sebagai syarat pengaturan profil biasa.",
          "Kamu juga menyetujui aturan untuk bertemu langsung hanya di tempat umum.",
        ],
      },
    ],
  },
  {
    id: "alias-anonim",
    title: "Nama samaran",
    blocks: [
      {
        type: "p",
        text: "Setiap akun mendapat nama samaran yang dibuat oleh sistem. Nama ini muncul di Cari Teman dan saat perkenalan sebelum kamu memilih membagikan nama asli. Nama samaran bukan nama resmi dan bukan email.",
      },
    ],
  },
  {
    id: "people-discovery",
    title: "Cari Teman",
    blocks: [
      {
        type: "p",
        text: "Jika kamu memilih untuk tampil, profilmu dapat muncul di Cari Teman bagi pengguna yang sudah masuk dan selesai mengatur profil. Informasi yang terlihat meliputi nama samaran, kampus, program studi, minat, tujuan mencari teman, dan perkenalan singkat, bukan kontak atau identitas lengkap.",
      },
      {
        type: "note",
        text: "Profilmu tidak ditampilkan kepada orang lain jika pengaturan awal belum selesai atau kamu memilih untuk tidak tampil di Cari Teman.",
      },
    ],
  },
  {
    id: "perkenalan",
    title: "Permintaan perkenalan",
    blocks: [
      {
        type: "p",
        text: "Pesan perkenalan bersifat privat antara pengirim dan penerima. Penerimaan tidak membuka identitas, kontak, atau dokumen. Ada batasan frekuensi dan aturan untuk mengurangi spam.",
      },
    ],
  },
  {
    id: "chat-anonim",
    title: "Percakapan tanpa nama asli",
    blocks: [
      {
        type: "p",
        text: "Setelah perkenalan diterima, kalian dapat bertukar pesan teks dalam percakapan privat. Isi pesan diproses untuk menyampaikan percakapan, menandai belum dibaca, serta mendukung aksi seperti mengakhiri percakapan, memblokir, atau melaporkan.",
      },
      {
        type: "p",
        text: "Pesan tidak dimaksudkan untuk dibuka ke publik. Kami tidak menjamin bahwa konten yang sudah dilihat lawan bicara (misalnya tangkapan layar) dapat dihapus dari perangkat mereka.",
      },
    ],
  },
  {
    id: "telegram-companion",
    title: "Lanjut ngobrol lewat Telegram",
    blocks: [
      {
        type: "p",
        text: "Kamu dapat melanjutkan satu percakapan StudyDate melalui @StudyDateBot. Fitur ini tidak menampilkan username, ID, nama, foto, atau informasi akun Telegram kepada lawan bicara dan tidak sama dengan membagikan kontak Telegram.",
      },
      {
        type: "ul",
        items: [
          "Kamu perlu membuka bot, lalu memastikan koneksi melalui akun StudyDate yang sudah masuk.",
          "StudyDate menyimpan pengenal Telegram secara privat hanya untuk menghubungkan dan meneruskan pesan. Informasi ini tidak ditampilkan di web.",
          "Pesan yang dikirim atau diterima melalui Telegram juga diproses oleh Telegram. Jalur ini tidak dinyatakan memiliki enkripsi menyeluruh.",
          "Memutuskan Telegram menghentikan penerusan pesan, tetapi tidak menghapus riwayat percakapan StudyDate. Data penghubung Telegram ikut dihapus saat akun StudyDate dihapus.",
        ],
      },
    ],
  },
  {
    id: "mutual-interest",
    title: "Pilihan “Kenal Lebih Jauh”",
    blocks: [
      {
        type: "p",
        text: "Pilihan “Kenal Lebih Jauh” bersifat privat sampai kedua pihak menyetujui. Persetujuan satu pihak tidak dibocorkan ke pihak lain sebelum keduanya memilih. Tahap ini tidak otomatis membuka nama, foto, atau kontak.",
      },
    ],
  },
  {
    id: "identity-reveal",
    title: "Membuka identitas",
    blocks: [
      {
        type: "p",
        text: "Setelah kalian sama-sama memilih Kenal Lebih Jauh, kamu dapat menyiapkan nama depan dan foto khusus untuk percakapan tersebut. Informasi ini baru dibagikan setelah kalian berdua setuju.",
      },
      {
        type: "ul",
        items: [
          "Tidak membuka nama lengkap resmi, NIM, email akun, atau kontak.",
          "Membuka nama dan foto tidak berarti identitas sudah terverifikasi secara resmi.",
          "Jika percakapan diakhiri setelah selesai, akses nama depan dan foto yang sudah dibuka dapat tetap tersedia. Jika pemilik data menghapus akun, StudyDate berhenti menyajikan identitas tersebut melalui layanan.",
          "Jika seseorang diblokir, StudyDate berhenti menampilkan nama dan fotonya pada akses berikutnya. Informasi yang sudah dilihat atau disimpan orang lain mungkin tetap ada di perangkat mereka.",
        ],
      },
    ],
  },
  {
    id: "contact-reveal",
    title: "Membagikan kontak",
    blocks: [
      {
        type: "p",
        text: "Setelah identitas dibuka, kontak dibuka per saluran dengan persetujuan terpisah. Saluran yang didukung saat ini hanya:",
      },
      {
        type: "ul",
        items: [
          "LinkedIn (tautan profil publik), wajib diisi agar profil dapat tampil di Cari Teman",
          "Instagram (nama pengguna), bersifat opsional",
          "Telegram (nama pengguna)",
        ],
      },
      {
        type: "p",
        text: "Di Edit Profil, kamu dapat menyimpan LinkedIn dan Instagram secara privat. Kontak tersebut tidak tampil di Cari Teman. Saat kamu memilih membagikan kontak, isian dapat terisi otomatis, tetapi tetap membutuhkan persetujuan kalian berdua untuk setiap jenis kontak.",
      },
      {
        type: "note",
        text: "Saat ini StudyDate tidak mendukung pembagian WhatsApp, nomor telepon, atau email melalui fitur ini. Kontak disimpan secara terlindungi dan hanya digunakan untuk percakapan yang kamu pilih. Tidak ada tombol “bagikan semua kontak”.",
      },
    ],
  },
  {
    id: "laporan-moderasi",
    title: "Laporan, blokir, dan moderasi",
    blocks: [
      {
        type: "p",
        text: "Kamu dapat memblokir atau melaporkan perilaku yang melanggar Pedoman Komunitas. Laporan hanya dapat diperiksa oleh petugas yang berwenang. Kami menggunakan informasi yang berkaitan dengan laporan sebatas yang diperlukan untuk menanganinya.",
      },
    ],
  },
  {
    id: "penyimpanan-privat",
    title: "Penyimpanan privat",
    blocks: [
      {
        type: "p",
        text: "Foto yang kamu unggah untuk dibagikan disimpan secara privat dan hanya dapat dibuka melalui fitur yang diizinkan. Bukti verifikasi mahasiswa juga disimpan secara privat dan hanya dapat diperiksa oleh petugas. Verifikasi belum dibuka untuk semua pengguna.",
      },
    ],
  },
  {
    id: "early-access",
    title: "Akses Awal",
    blocks: [
      {
        type: "p",
        text: "Jika kamu mendaftar Akses Awal dari beranda, kami menggunakan email, kampus (opsional), minat yang dipilih, bagian halaman tempat kamu mendaftar, dan catatan persetujuan. Data ini dipakai untuk mengelola pendaftaran, bukan untuk menampilkan profilmu.",
      },
    ],
  },
  {
    id: "analitik-teknis",
    title: "Data kunjungan dan catatan sistem",
    blocks: [
      {
        type: "p",
        text: "StudyDate tidak memasang jaringan iklan pihak ketiga. Halaman publik memakai Vercel Web Analytics untuk menghitung kunjungan secara keseluruhan dan mengetahui asal kunjungan, tanpa mengirim NIM, identitas mahasiswa, isi percakapan, kontak, atau data verifikasi. Penghitungan ini tidak dipasang di ruang akun yang privat. Sistem juga dapat menyimpan catatan teknis secukupnya untuk keamanan dan perbaikan layanan, bukan untuk membuat profil iklan tentangmu.",
      },
    ],
  },
  {
    id: "retensi",
    title: "Berapa lama data disimpan",
    blocks: [
      {
        type: "p",
        text: "Kami menyimpan data selama akun aktif dan selama diperlukan untuk menjalankan fitur, seperti profil, percakapan, persetujuan, dan laporan. Setelah penghapusan akun dimulai, data privat diproses untuk dihapus. Sebagian riwayat bersama dapat tetap ada dengan identitas “Akun dihapus” agar percakapan pengguna lain tetap dapat dipahami. Bukti laporan disimpan sampai kasus selesai dan, bila diperlukan untuk keamanan, paling lama 180 hari setelah penanganan selesai.",
      },
    ],
  },
  {
    id: "penghapusan-akun",
    title: "Penghapusan akun",
    blocks: [
      {
        type: "p",
        text: "Di Pengaturan, akun mahasiswa dapat dinonaktifkan sementara atau diajukan untuk dihapus. Setelah permintaan penghapusan dikirim, profil dan akses akun langsung dinonaktifkan, lalu sistem memproses penghapusan data privat, foto yang dibagikan, kontak, dan data verifikasi. Circle milik akun diarsipkan dan acara mendatang yang dikelola akun tersebut dibatalkan. Riwayat bersama dan bukti laporan yang masih diperlukan dapat tetap tersedia dengan nama “Akun dihapus”. Informasi yang sebelumnya sudah dilihat atau disalin orang lain mungkin tetap ada di perangkat mereka. Penghapusan akun staf ditangani melalui proses terpisah.",
      },
    ],
  },
  {
    id: "keamanan",
    title: "Cara kami menjaga data",
    blocks: [
      {
        type: "p",
        text: "Kami membatasi siapa yang dapat membuka data, melindungi data sensitif tertentu dengan enkripsi, dan menyimpan unggahan sensitif secara privat. Tidak ada sistem yang dapat menjamin keamanan mutlak. Lindungi akun emailmu karena tautan masuk StudyDate dikirim ke sana.",
      },
    ],
  },
  {
    id: "pihak-ketiga",
    title: "Pemroses pihak ketiga",
    blocks: [
      {
        type: "p",
        text: "Untuk mengoperasikan layanan, StudyDate memakai penyedia infrastruktur yang diperlukan, antara lain:",
      },
      {
        type: "ul",
        items: [
          "Supabase, untuk masuk ke akun, basis data, dan penyimpanan file privat.",
          "Layanan pengiriman email, untuk mengirim tautan masuk bermerek StudyDate.",
          "Layanan hosting, untuk menjalankan situs dan layanan StudyDate.",
          "Telegram, hanya jika pengguna memilih melanjutkan percakapan melalui @StudyDateBot.",
        ],
      },
      {
        type: "p",
        text: "Penyedia tersebut memproses data hanya sejauh dibutuhkan untuk menjalankan fungsi di atas, sesuai kontrak dan konfigurasi kami.",
      },
    ],
  },
  {
    id: "google-oauth",
    title: "Masuk dengan Google",
    blocks: [
      {
        type: "p",
        text: "StudyDate menawarkan Masuk dengan Google sebagai alternatif tautan email. Saat kamu memilih Google, kami menerima dari Google data dasar yang diperlukan untuk autentikasi (terutama alamat email akun Google dan pengenal akun) melalui Supabase Auth.",
      },
      {
        type: "ul",
        items: [
          "Email Google harus masuk daftar domain yang didukung (saat ini @gmail.com, @vk.com, atau berakhiran .ac.id / .sch.id).",
          "Jika email Google di luar daftar itu, sesi tidak dilanjutkan dan kamu diminta memakai email yang didukung.",
          "Kami tidak memakai Masuk dengan Google untuk mengakses isi Gmail, Drive, atau data Google lain di luar cakupan login.",
        ],
      },
    ],
  },
  {
    id: "domain-email",
    title: "Batasan domain email",
    blocks: [
      {
        type: "p",
        text: "Untuk menjaga komunitas mahasiswa, pendaftaran dan masuk publik (termasuk Early Access) dibatasi pada email @gmail.com, @vk.com, serta alamat yang berakhiran .ac.id atau .sch.id. Login staf memakai jalur terpisah dan tidak memakai batasan domain yang sama.",
      },
    ],
  },
  {
    id: "verifikasi-mahasiswa",
    title: "Verifikasi mahasiswa",
    blocks: [
      {
        type: "note",
        text: "Pusat Verifikasi Mahasiswa belum dibuka untuk semua pengguna. Pengajuan baru hanya tersedia dalam tahap uji terbatas.",
      },
      {
        type: "p",
        text: "Pada tahap uji terbatas, StudyDate dapat memakai layanan data akademik untuk membandingkan NIM, nama lengkap resmi, kampus, dan program studi yang dikirim pengguna. Hasil pencarian lain tidak disimpan sebagai profil. Jika pencarian tidak tersedia atau tidak cocok, pengguna dapat mengirim tangkapan layar PDDIKTI untuk diperiksa petugas. Tangkapan layar belum membuktikan bahwa akun tersebut benar milik mahasiswa terkait; email kampus atau kartu mahasiswa tetap diperlukan secara terpisah. Bukti disimpan secara privat dan ikut dihapus bersama data verifikasi saat akun dihapus.",
      },
    ],
  },
  {
    id: "anak-usia",
    title: "Anak-anak dan usia",
    blocks: [
      {
        type: "p",
        text: "StudyDate ditujukan untuk mahasiswa dan alumni, bukan anak-anak. Ketentuan usia minimum yang lebih rinci akan ditetapkan sebelum layanan dibuka lebih luas. Jika kamu menduga ada akun yang tidak memenuhi syarat, laporkan melalui halaman Bantuan.",
      },
    ],
  },
  {
    id: "hak-pengguna",
    title: "Hak dan kontak",
    blocks: [
      {
        type: "p",
        text: "Kamu dapat melihat dan memperbarui profil di Pengaturan, memilih apakah profil tampil di Cari Teman, mengelola daftar blokir, menonaktifkan akun, atau meminta penghapusan akun. Untuk kebutuhan lain yang belum tersedia di aplikasi, gunakan halaman Bantuan.",
      },
      {
        type: "ul",
        items: [
          "Bantuan: /help",
          "Pedoman Komunitas: /community-guidelines",
          "Pusat Keamanan: /safety",
        ],
      },
    ],
  },
  {
    id: "perubahan",
    title: "Perubahan kebijakan",
    blocks: [
      {
        type: "p",
        text: "Kami dapat memperbarui Kebijakan Privasi agar selaras dengan perubahan produk, hukum, atau operasional. Tanggal “Terakhir diperbarui” di atas halaman ini akan disesuaikan. Perubahan material akan diusahakan untuk dikomunikasikan melalui saluran yang wajar (misalnya pemberitahuan di aplikasi atau email akun) bila memungkinkan.",
      },
    ],
  },
];
