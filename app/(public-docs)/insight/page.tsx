import { JsonLd } from "@/components/marketing/json-ld";
import { insightArticles } from "@/content/insight/articles";
import { breadcrumbJsonLd } from "@/lib/marketing/structured-data";
import type { Metadata } from "next";
import Link from "next/link";

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
      <article className="page-shell py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-[42rem]">
          <p className="section-label">StudyDate ID</p>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl lg:text-[2.65rem]">
            Insight Mahasiswa
          </h1>
          <p className="mt-4 text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
            Penjelasan langsung dan panduan praktis untuk belajar bersama,
            membangun koneksi, menjaga privasi, dan bertemu secara lebih aman.
          </p>

          <div className="mt-10 border-t border-brand-border">
            {insightArticles.map((article) => (
              <section
                key={article.slug}
                className="border-b border-brand-border py-7"
              >
                <h2 className="font-heading text-xl font-semibold text-brand-navy sm:text-2xl">
                  <Link
                    href={`/insight/${article.slug}`}
                    className="focus-ring rounded-sm hover:text-brand-blue"
                  >
                    {article.title}
                  </Link>
                </h2>
                <p className="mt-3 text-sm leading-7 text-brand-muted sm:text-base">
                  {article.description}
                </p>
                <Link
                  href={`/insight/${article.slug}`}
                  className="focus-ring mt-4 inline-flex rounded-sm text-sm font-semibold text-brand-blue underline-offset-4 hover:underline"
                >
                  Baca panduan
                </Link>
              </section>
            ))}
          </div>
        </div>
      </article>
    </>
  );
}
