import { JsonLd } from "@/components/marketing/json-ld";
import {
  getInsightArticle,
  insightArticles,
} from "@/content/insight/articles";
import {
  articleJsonLd,
  breadcrumbJsonLd,
} from "@/lib/marketing/structured-data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return insightArticles.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getInsightArticle((await params).slug);
  if (!article) return {};
  const path = `/insight/${article.slug}`;

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: path },
    openGraph: {
      title: `${article.title} | StudyDate ID`,
      description: article.description,
      url: path,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.modifiedAt,
    },
    robots: { index: true, follow: true },
  };
}

export default async function InsightArticlePage({ params }: Props) {
  const article = getInsightArticle((await params).slug);
  if (!article) notFound();
  const path = `/insight/${article.slug}`;

  return (
    <>
      <JsonLd
        data={[
          articleJsonLd({ ...article, path }),
          breadcrumbJsonLd([
            { name: "StudyDate ID", path: "/" },
            { name: "Insight", path: "/insight" },
            { name: article.title, path },
          ]),
        ]}
      />
      <article className="page-shell py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-[42rem]">
          <nav aria-label="Breadcrumb" className="text-sm text-brand-muted">
            <Link
              href="/insight"
              className="focus-ring rounded-sm hover:text-brand-blue"
            >
              Insight
            </Link>
            <span aria-hidden className="mx-2">
              /
            </span>
            <span>{article.title}</span>
          </nav>
          <h1 className="mt-5 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl lg:text-[2.65rem]">
            {article.title}
          </h1>
          <p className="mt-5 text-lg leading-8 text-brand-navy">
            {article.answer}
          </p>
          <p className="mt-5 text-sm text-brand-muted">
            Diterbitkan{" "}
            <time dateTime={article.publishedAt}>16 Agustus 2026</time>
          </p>

          <div className="mt-12 space-y-12">
            {article.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-24"
              >
                <h2 className="font-heading text-xl font-semibold tracking-[-0.02em] text-brand-navy sm:text-2xl">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-[15px] leading-7 text-brand-navy/90 sm:text-base sm:leading-8">
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.items ? (
                    <ul className="list-disc space-y-2 pl-5 marker:text-brand-blue">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ))}
          </div>

          <aside className="mt-12 border-t border-brand-border pt-8">
            <h2 className="font-heading text-lg font-semibold text-brand-navy">
              Lanjutkan membaca
            </h2>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              <Link
                href="/safety"
                className="focus-ring rounded-sm text-brand-blue hover:underline"
              >
                Pusat Keamanan
              </Link>
              <Link
                href="/community-guidelines"
                className="focus-ring rounded-sm text-brand-blue hover:underline"
              >
                Pedoman Komunitas
              </Link>
              <Link
                href="/help"
                className="focus-ring rounded-sm text-brand-blue hover:underline"
              >
                Cara kerja StudyDate
              </Link>
            </div>
          </aside>
        </div>
      </article>
    </>
  );
}
