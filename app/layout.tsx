import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { getPublicSiteOrigin } from "@/lib/marketing/site-origin";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteOrigin()),
  title: {
    default: "StudyDate ID — Temukan koneksi di kampus",
    template: "%s",
  },
  description:
    "Temukan people, groups, dan campus events untuk belajar, berteman, networking, berkolaborasi, dan membangun koneksi yang berarti.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  icons: {
    icon: "/brand/app-icon.png",
    apple: "/brand/app-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "StudyDate ID",
    title: "StudyDate ID — Temukan koneksi di kampus",
    description:
      "Temukan people, groups, dan campus events untuk belajar, berteman, networking, berkolaborasi, dan membangun koneksi yang berarti.",
  },
  twitter: {
    card: "summary_large_image",
    title: "StudyDate ID — Temukan koneksi di kampus",
    description:
      "Temukan people, groups, dan campus events untuk belajar, berteman, networking, berkolaborasi, dan membangun koneksi yang berarti.",
  },
};

const inter = Inter({
  variable: "--font-inter",
  display: "swap",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  display: "swap",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.variable} ${poppins.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
