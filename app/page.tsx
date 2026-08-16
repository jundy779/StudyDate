import { LandingPage } from "@/components/marketing/landing-page";
import { JsonLd } from "@/components/marketing/json-ld";
import {
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/marketing/structured-data";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function Home() {
  return (
    <>
      <JsonLd data={[organizationJsonLd, websiteJsonLd]} />
      <LandingPage />
      <Analytics />
    </>
  );
}
