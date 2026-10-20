import { JsonLd } from "@/components/marketing/json-ld";
import { insightArticles } from "@/content/insight/articles";
import { breadcrumbJsonLd } from "@/lib/marketing/structured-data";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/marketing/brand-ui";

export const metadata: Metadata = {
  title: "Insight Mahasiswa",
  description:
    "Panduan praktis tentang teman belajar, koneksi mahasiswa, privasi, dan pertemuan yang aman.",
  alternates: { canonical: "/insight" },
  openGraph: {
    title: "Insight Mahasiswa | StudyDate ID",
    description:
      "Panduan praktis tentang teman belajar, koneksi mahasiswa, privasi, dan pertemuan yang aman.",
    url: "/insight",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function InsightPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "StudyDate ID", path: "/" },
          { name: "Insight", path: "/insight" },
        ])}
      />
      <article>
        <PageHero note="Bacaan singkat" title="Insight Mahasiswa" mascot="mikir">
          Penjelasan langsung dan panduan praktis untuk belajar bersama, membangun
          koneksi, menjaga privasi, dan bertemu secara lebih aman.
        </PageHero>

        <div className="page-shell py-12 sm:py-16">
          <ul className="mx-auto max-w-3xl divide-y-2 divide-brand-navy/10 border-y-2 border-brand-navy/10">
            {insightArticles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/insight/${article.slug}`}
                  className="focus-ring group grid gap-3 py-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-10"
                >
                  <span>
                    <span className="block font-heading text-xl font-semibold text-brand-navy transition-colors group-hover:text-brand-blue sm:text-2xl">
                      {article.title}
                    </span>
                    <span className="mt-3 block text-sm leading-7 text-brand-muted sm:text-base">
                      {article.description}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-blue">
                    Baca panduan
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </>
  );
}
