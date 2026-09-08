export type InsightSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export type InsightArticle = {
  slug: string;
  title: string;
  description: string;
  answer: string;
  publishedAt: string;
  modifiedAt: string;
  sections: InsightSection[];
};

export const insightArticles = [
  {
    slug: "apa-itu-study-date",
    title: "Apa Itu Study Date?",
    description:
      "Arti study date, cara menjalaninya dengan aman, dan mengapa study date tidak selalu romantis.",
    answer:
      "Study date adalah waktu yang disepakati untuk belajar bersama sambil saling mengenal dalam suasana yang nyaman. Kegiatannya dapat berlangsung online atau di tempat publik, dan tidak harus bersifat romantis: tujuannya bisa belajar, berteman, networking, atau membangun koneksi secara perlahan.",
    publishedAt: "2026-08-16",
    modifiedAt: "2026-08-16",
    sections: [
      {
        id: "cara-kerja",
        title: "Bagaimana study date bekerja?",
        paragraphs: [
          "Mulailah dengan tujuan yang jelas: topik belajar, durasi, format online atau offline, dan batas kenyamanan masing-masing. Jika bertemu offline, sepakati tempat publik yang ramai, terang, mudah diakses, dan masih beroperasi.",
          "Di StudyDate ID, mahasiswa melihat minat dan tujuan koneksi lebih dulu. Nama asli, foto, dan kontak baru dibagikan bertahap setelah ada persetujuan bersama.",
        ],
      },
      {
        id: "tidak-selalu-romantis",
        title: "Apakah study date selalu romantis?",
        paragraphs: [
          "Tidak. Study date dapat menjadi sesi belajar bersama, awal pertemanan, networking mahasiswa, atau cara mengenal orang baru. Hubungan romantis mungkin berkembang secara alami, tetapi bukan kewajiban maupun hasil yang dijanjikan.",
        ],
      },
      {
        id: "tempat-aman",
        title: "Bagaimana memilih tempat yang aman?",
        items: [
          "Pilih perpustakaan, ruang belajar bersama, kafe, atau area kampus yang terbuka untuk umum.",
          "Pastikan tempat ramai, terang, mudah dijangkau, dan masih beroperasi selama pertemuan.",
          "Hindari rumah, kamar, kendaraan pribadi, atau lokasi sepi sebagai pertemuan awal.",
          "Sampaikan rencana kepada orang tepercaya dan pulang jika situasi terasa tidak nyaman.",
        ],
      },
      {
        id: "menjaga-privasi",
        title: "Bagaimana menjaga privasi saat berkenalan?",
        paragraphs: [
          "Bagikan informasi secukupnya dan hindari NIM, dokumen, alamat, lokasi presisi, atau kontak pribadi pada tahap awal. Persetujuan untuk membuka satu jenis informasi tidak berarti semua identitas dan kontak otomatis terbuka.",
          "Fitur privasi membantu mengurangi paparan, tetapi tidak menjamin keamanan mutlak. Gunakan blokir dan laporkan bila ada tekanan, pelecehan, scam, atau pelanggaran batas.",
        ],
      },
    ],
  },
] satisfies InsightArticle[];

export function getInsightArticle(slug: string) {
  return insightArticles.find((article) => article.slug === slug);
}
