import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { getPublicSiteOrigin } from "@/lib/marketing/site-origin";
import "./globals.css";

const description =
  "StudyDate ID membantu mahasiswa menemukan teman belajar, circle kecil, dan acara kampus tanpa langsung membagikan nama asli atau kontak pribadi.";

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteOrigin()),
  applicationName: "StudyDate ID",
  title: {
    default: "StudyDate ID — Teman, circle, dan acara kampus",
    template: "%s",
  },
  description,
  icons: {
    icon: "/brand/app-icon.png",
    apple: "/brand/app-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "StudyDate ID",
    title: "StudyDate ID — Teman, circle, dan acara kampus",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "StudyDate ID — Teman, circle, dan acara kampus",
    description,
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
