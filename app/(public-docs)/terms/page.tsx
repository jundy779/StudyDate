import type { Metadata } from "next";
import { PublicDocArticle } from "@/components/marketing/public-doc-article";
import { termsIntro, termsSections } from "@/content/public-docs/terms";

export const metadata: Metadata = {
  title: "Ketentuan Layanan — StudyDate ID",
  description:
    "Aturan penggunaan StudyDate ID: akun, perilaku, pembagian identitas dan kontak, serta pertemuan di tempat umum.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Ketentuan Layanan — StudyDate ID",
    description:
      "Ketentuan penggunaan StudyDate ID yang jelas dan sesuai dengan perilaku produk.",
    url: "/terms",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <PublicDocArticle
      title="Ketentuan Layanan"
      intro={termsIntro}
      sections={termsSections}
    />
  );
}
