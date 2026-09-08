import type { Metadata } from "next";
import { PublicDocArticle } from "@/components/marketing/public-doc-article";
import { helpIntro, helpSections } from "@/content/public-docs/help";

export const metadata: Metadata = {
  title: "Bantuan — StudyDate ID",
  description:
    "Panduan singkat untuk mencari teman, mengirim perkenalan, chat anonim, membuka identitas dan kontak, serta login.",
  alternates: { canonical: "/help" },
  openGraph: {
    title: "Bantuan — StudyDate ID",
    description:
      "Cara kerja fitur StudyDate dan tautan ke privasi serta keamanan.",
    url: "/help",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function HelpPage() {
  return (
    <PublicDocArticle
      title="Bantuan"
      intro={helpIntro}
      sections={helpSections}
    />
  );
}
