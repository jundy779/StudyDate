import type { Metadata } from "next";
import { PublicDocArticle } from "@/components/marketing/public-doc-article";
import { safetyIntro, safetySections } from "@/content/public-docs/safety";

export const metadata: Metadata = {
  title: "Pusat Keamanan — StudyDate ID",
  description:
    "Prinsip anonymous-first, tip keamanan akun, block/lapor, dan pertemuan offline hanya di tempat umum.",
  alternates: { canonical: "/safety" },
  openGraph: {
    title: "Pusat Keamanan — StudyDate ID",
    description:
      "Panduan keamanan StudyDate: reveal bertahap, tempat umum, dan tanda scam.",
    url: "/safety",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function SafetyPage() {
  return (
    <PublicDocArticle
      title="Pusat Keamanan"
      intro={safetyIntro}
      sections={safetySections}
    />
  );
}
