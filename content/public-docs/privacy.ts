import type { PublicDocSection } from "@/components/marketing/public-doc-article";

export const privacyIntro =
  "Kebijakan ini menjelaskan data yang StudyDate ID proses agar kamu bisa memakai layanan dengan tenang. Kami menulisnya berdasarkan perilaku produk yang sudah diimplementasikan, bukan janji fitur yang belum aktif.";

export const privacySections: PublicDocSection[] = [
  {
    id: "ringkasan",
    title: "Ringkasan",
    blocks: [
      {
        type: "p",
        text: "StudyDate ID adalah platform koneksi mahasiswa yang mengutamakan privasi, persetujuan, dan pengenalan bertahap. Kami meminimalkan data yang terlihat publik dan membuka identitas atau kontak hanya setelah kedua pihak menyetujui tahap yang relevan.",
      },
      {
        type: "ul",
        items: [
          "Masuk memakai tautan email (passwordless), bukan kata sandi.",
          "Profil discovery menampilkan alias anonim dan konteks kampus yang kamu pilih, bukan identitas lengkap.",
          "Chat, Mutual Interest, Identity Reveal, dan Contact Reveal berjalan bertahap dengan persetujuan terpisah.",
          "Verifikasi mahasiswa saat ini dinonaktifkan secara global dan tidak digambarkan sebagai fitur aktif.",
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
        text: "StudyDate ID mengoperasikan layanan di domain produksi yang dituju: studydate.id. Untuk pertanyaan privasi, gunakan halaman Bantuan. Alamat email dukungan publik resmi belum dipublikasikan di situs ini sampai Owner menetapkan kanal resmi domain studydate.id.",
      },
    ],
  },
  {
    id: "akun-autentikasi",
    title: "Akun dan autentikasi",
    blocks: [
      {
        type: "p",
        text: "Untuk membuat atau membuka sesi, kami memproses alamat email yang kamu masukkan dan mengirim tautan masuk bermerek StudyDate. Sesi diautentikasi di server; kami tidak memakai kata sandi akun mahasiswa di alur produk saat ini.",
      },
      {
        type: "ul",
        items: [
          "Data: email akun, status sesi, dan metadata teknis yang dibutuhkan untuk keamanan login.",
          "Tujuan: mengautentikasi pengguna, mencegah penyalahgunaan tautan masuk, dan mengarahkan ke onboarding atau aplikasi.",
          "Kami tidak memublikasikan email akun ke pengguna lain.",
        ],
      },
    ],
  },
  {
    id: "onboarding-profil",
    title: "Onboarding dan data profil",
    blocks: [
      {
        type: "p",
        text: "Saat onboarding, kamu dapat mengisi data seperti nama depan, nama belakang, kampus, program studi, jenjang, semester (opsional), kota/wilayah umum (opsional), minat, tujuan koneksi, preferensi cara memulai, serta persetujuan Ketentuan, Privasi, dan Pedoman Komunitas. Nama depan dan nama belakang disimpan privat; People menampilkan alias anonim, bukan nama lengkap.",
      },
      {
        type: "ul",
        items: [
          "NIM bersifat opsional. Jika diisi, disimpan secara terpisah dan terlindungi—bukan bagian dari profil publik.",
          "Kami tidak meminta nama lengkap, nomor telepon, alamat rumah, lokasi presisi, atau dokumen identitas sebagai syarat onboarding biasa.",
          "Kamu juga menyetujui aturan pertemuan offline hanya di tempat umum.",
        ],
      },
    ],
  },
  {
    id: "alias-anonim",
    title: "Alias anonim",
    blocks: [
      {
        type: "p",
        text: "Setiap akun mendapat alias publik anonim yang dibuat sistem. Alias inilah yang muncul di People Discovery dan alur perkenalan sebelum Identity Reveal selesai. Alias bukan nama legal dan bukan email.",
      },
    ],
  },
  {
    id: "people-discovery",
    title: "People Discovery",
    blocks: [
      {
        type: "p",
        text: "Jika kamu memilih dapat ditemukan, profil anonim dapat muncul di People bagi pengguna yang sudah masuk dan menyelesaikan onboarding. Yang ditampilkan mencakup konteks seperti alias, kampus, program studi, minat, tujuan koneksi, dan intro singkat—bukan kontak atau identitas lengkap.",
      },
      {
        type: "note",
        text: "Profilmu tidak ditampilkan ke pengguna lain bila onboarding belum selesai atau kamu tidak memilih untuk dapat ditemukan. Detail People memakai alias, bukan pengenal internal.",
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
    title: "Percakapan anonim",
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
    id: "mutual-interest",
    title: "Mutual Interest (“Kenal Lebih Jauh”)",
    blocks: [
      {
        type: "p",
        text: "Pilihan “Kenal Lebih Jauh” bersifat privat sampai kedua pihak menyetujui. Persetujuan satu pihak tidak dibocorkan ke pihak lain sebelum menjadi mutual. Tahap ini tidak otomatis membuka Identity Reveal atau Contact Reveal.",
      },
    ],
  },
  {
    id: "identity-reveal",
    title: "Identity Reveal",
    blocks: [
      {
        type: "p",
        text: "Setelah Mutual Interest selesai, kalian dapat menyiapkan dan menyetujui pembukaan identitas terbatas untuk percakapan itu: nama depan yang kamu siapkan dan foto yang kamu unggah khusus untuk reveal. Data ini bersifat lingkup percakapan dan membutuhkan persetujuan dua arah.",
      },
      {
        type: "ul",
        items: [
          "Tidak membuka nama legal, NIM, email akun, atau kontak.",
          "Tidak mengklaim bahwa Identity Reveal sama dengan “identitas terverifikasi secara resmi”.",
          "Jika percakapan diakhiri setelah selesai, akses nama depan dan foto yang sudah dibuka dapat tetap tersedia sesuai kebijakan retensi produk.",
          "Jika ada pemblokiran, proyeksi identitas lawan dihentikan pada permintaan berikutnya—tanpa menjamin penghapusan konten yang sudah dilihat.",
        ],
      },
    ],
  },
  {
    id: "contact-reveal",
    title: "Contact Reveal",
    blocks: [
      {
        type: "p",
        text: "Setelah Identity Reveal selesai, kontak dibuka per saluran dengan persetujuan terpisah. Saluran yang didukung saat ini hanya:",
      },
      {
        type: "ul",
        items: [
          "LinkedIn (URL profil publik) — diprioritaskan; di Edit profil LinkedIn wajib untuk tampil di People",
          "Instagram (username) — opsional di profil dan Contact Reveal",
          "Telegram (username)",
        ],
      },
      {
        type: "p",
        text: "Di Edit profil kamu dapat menyimpan LinkedIn (wajib) dan Instagram (opsional) sebagai default privat. Nilai itu tidak tampil di People; saat Contact Reveal, form dapat diisi otomatis dari default tersebut, lalu tetap membutuhkan persetujuan dua arah per saluran.",
      },
      {
        type: "note",
        text: "StudyDate tidak mendukung pembukaan WhatsApp, nomor telepon, atau email sebagai Contact Reveal pada versi ini. Nilai kontak dilindungi di sisi layanan dan bersifat lingkup percakapan. Tidak ada tombol “buka semua kontak”.",
      },
    ],
  },
  {
    id: "laporan-moderasi",
    title: "Laporan, blokir, dan moderasi",
    blocks: [
      {
        type: "p",
        text: "Kamu dapat memblokir atau melaporkan perilaku yang melanggar Pedoman Komunitas. Laporan dapat ditinjau oleh staf yang berwenang untuk menjaga keamanan komunitas. Kami memproses data laporan, konteks yang relevan, dan status penanganan sebatas yang diperlukan untuk triage.",
      },
    ],
  },
  {
    id: "penyimpanan-privat",
    title: "Penyimpanan privat",
    blocks: [
      {
        type: "p",
        text: "File yang kamu unggah untuk Identity Reveal (foto) disimpan secara privat dan diakses hanya melalui jalur produk yang diizinkan. Bila fitur verifikasi mahasiswa diaktifkan di kemudian hari, bukti pendukung juga akan diperlakukan sebagai penyimpanan privat dengan akses terbatas untuk review—fitur tersebut saat ini tidak aktif secara global.",
      },
    ],
  },
  {
    id: "early-access",
    title: "Early Access / daftar minat",
    blocks: [
      {
        type: "p",
        text: "Jika kamu mendaftar Early Access dari beranda, kami memproses email, kampus (opsional), minat yang dipilih, sumber CTA, dan catatan persetujuan. Data ini dipakai untuk mengelola antrean akses awal, bukan untuk memublikasikan profilmu.",
      },
    ],
  },
  {
    id: "analitik-teknis",
    title: "Analitik dan log teknis",
    blocks: [
      {
        type: "p",
        text: "StudyDate tidak memasang jaringan iklan pihak ketiga atau analitika pemasaran pihak ketiga pada halaman publik saat ini. Dialog Early Access dapat memancarkan peristiwa antarmuka lokal di peramban untuk memahami alur formulir. Server dapat mencatat log teknis terbatas (misalnya kesalahan, pembatasan laju, dan sinyal keamanan) untuk menjaga keandalan layanan—bukan untuk membuat profil iklan tentangmu.",
      },
    ],
  },
  {
    id: "retensi",
    title: "Retensi",
    blocks: [
      {
        type: "p",
        text: "Kami menyimpan data selama akun aktif dan selama diperlukan untuk menyediakan fitur (profil, percakapan, consent, laporan). Setelah Identity Reveal atau Contact Reveal selesai, akses terbatas dapat dipertahankan sesuai perilaku produk bila percakapan diakhiri secara normal. Mahasiswa dapat menonaktifkan akun atau mengirim permintaan penghapusan dari Pengaturan; lihat bagian penghapusan akun.",
      },
    ],
  },
  {
    id: "penghapusan-akun",
    title: "Penghapusan akun",
    blocks: [
      {
        type: "p",
        text: "Di Pengaturan, akun mahasiswa dapat: (1) dinonaktifkan sementara—profil disembunyikan dari People dan akses aplikasi diblokir sampai diaktifkan kembali, sementara data tetap di server; atau (2) mengirim permintaan penghapusan. Saat permintaan diterima, profil segera disembunyikan dan akses sosial dinonaktifkan. Cleanup final belum dijalankan sampai Owner menyetujui kebijakan retensi untuk Identity Reveal, Contact Reveal, percakapan dan riwayat grup, bukti moderasi, Circle yang dimiliki, serta Event yang diorganisasi. Akun staf tidak memakai alur self-service ini.",
      },
    ],
  },
  {
    id: "keamanan",
    title: "Praktik keamanan (tingkat tinggi)",
    blocks: [
      {
        type: "p",
        text: "Kami menerapkan kontrol akses berbasis sesi di server, pembatasan data yang terlihat antar pengguna, enkripsi untuk data sensitif tertentu (misalnya nilai Contact Reveal dan klaim NIM opsional), serta penyimpanan privat untuk unggahan sensitif. Tidak ada sistem yang menjamin keamanan mutlak. Lindungi akses emailmu karena tautan masuk dikirim ke sana.",
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
          "Supabase — autentikasi, basis data, dan penyimpanan file privat sesuai konfigurasi layanan.",
          "Pengiriman email produk (SMTP atau penyedia email transaksi) — untuk mengirim tautan masuk bermerek StudyDate.",
          "Hosting aplikasi web — untuk menyajikan situs dan API StudyDate.",
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
        text: "StudyDate menawarkan Masuk dengan Google sebagai alternatif tautan email. Saat kamu memilih Google, kami menerima dari Google data dasar yang diperlukan untuk autentikasi—terutama alamat email akun Google dan pengenal akun—melalui Supabase Auth.",
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
        text: "Pusat Verifikasi Mahasiswa saat ini dinonaktifkan secara global. StudyDate tidak mengoperasikan pengajuan verifikasi aktif untuk pengguna umum pada konfigurasi ini. Jika fitur diaktifkan nanti, kebijakan ini akan diperbarui agar mencerminkan data bukti, review, dan retensi yang benar-benar berlaku.",
      },
    ],
  },
  {
    id: "anak-usia",
    title: "Anak-anak dan usia",
    blocks: [
      {
        type: "p",
        text: "StudyDate ditujukan untuk komunitas mahasiswa. Kami tidak menargetkan anak-anak sebagai audiens produk. Batas usia minimum yang mengikat secara terpisah (di luar konteks mahasiswa) belum ditetapkan secara formal di kebijakan ini; Owner dapat memperjelas sebelum perluasan publik yang lebih luas. Jika kamu percaya akun dibuat oleh seseorang yang tidak pantas memakai layanan mahasiswa, hubungi kami melalui Bantuan.",
      },
    ],
  },
  {
    id: "hak-pengguna",
    title: "Hak dan kontak",
    blocks: [
      {
        type: "p",
        text: "Kamu dapat meninjau dan memperbarui data profil belajar di Pengaturan, mengatur visibilitas People, mengelola blokir sendiri, menonaktifkan akun, atau mengirim permintaan penghapusan. Untuk permintaan akses tambahan atau koreksi yang belum tersedia di antarmuka, gunakan halaman Bantuan.",
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
