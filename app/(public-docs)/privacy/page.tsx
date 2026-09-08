import type { Metadata } from "next";
import { PublicDocArticle } from "@/components/marketing/public-doc-article";
import { privacyIntro, privacySections } from "@/content/public-docs/privacy";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — StudyDate ID",
  description:
    "Bagaimana StudyDate ID mengumpulkan, memakai, dan melindungi data akun, profil anonim, percakapan, identitas, dan kontak.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Kebijakan Privasi — StudyDate ID",
    description:
      "Privasi, persetujuan, dan data yang StudyDate ID proses berdasarkan perilaku produk saat ini.",
    url: "/privacy",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <PublicDocArticle
      title="Kebijakan Privasi"
      intro={privacyIntro}
      sections={privacySections}
    />
  );
}
