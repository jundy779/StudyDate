import type { Metadata } from "next";
import { PublicDocArticle } from "@/components/marketing/public-doc-article";
import {
  communityIntro,
  communitySections,
} from "@/content/public-docs/community";

export const metadata: Metadata = {
  title: "Pedoman Komunitas — StudyDate ID",
  description:
    "Norma komunitas StudyDate ID: saling menghormati, tanpa pelecehan, scam, doxxing, atau tekanan reveal.",
  alternates: { canonical: "/community-guidelines" },
  openGraph: {
    title: "Pedoman Komunitas — StudyDate ID",
    description:
      "Aturan praktis agar StudyDate tetap hormat, aman, dan anonymous-first.",
    url: "/community-guidelines",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function CommunityGuidelinesPage() {
  return (
    <PublicDocArticle
      title="Pedoman Komunitas"
      intro={communityIntro}
      sections={communitySections}
    />
  );
}
