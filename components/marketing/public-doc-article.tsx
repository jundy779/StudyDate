import {
  PUBLIC_DOC_LAST_UPDATED_ISO,
  PUBLIC_DOC_LAST_UPDATED_LABEL,
} from "@/lib/marketing/public-routes";

export type PublicDocBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "note"; text: string };

export type PublicDocSection = {
  id: string;
  title: string;
  blocks: PublicDocBlock[];
};

type PublicDocArticleProps = {
  eyebrow?: string;
  title: string;
  intro: string;
  sections: PublicDocSection[];
};

export function PublicDocArticle({
  eyebrow = "StudyDate ID",
  title,
  intro,
  sections,
}: PublicDocArticleProps) {
  const toc = (
    <ol className="space-y-1.5 text-sm leading-6 text-brand-navy">
      {sections.map((section, index) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="focus-ring grid grid-cols-[1.75rem_minmax(0,1fr)] rounded-md px-1 py-0.5 hover:bg-white hover:text-brand-blue"
          >
            <span className="font-semibold text-brand-blue">{index + 1}</span>
            <span>{section.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <article>
      <header className="notebook-paper relative overflow-x-clip border-b border-brand-border">
        <span className="notebook-margin hidden sm:block" aria-hidden="true" />
        <div className="page-shell relative py-12 sm:py-16">
          <div className="max-w-3xl sm:pl-10 lg:pl-14">
            <p className="font-hand text-xl text-brand-blue sm:text-2xl">{eyebrow}</p>
            <h1 className="mt-3 text-balance font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl lg:text-5xl lg:leading-[1.1]">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
              {intro}
            </p>
            <p className="mt-5 text-sm text-brand-muted">
              Terakhir diperbarui:{" "}
              <time dateTime={PUBLIC_DOC_LAST_UPDATED_ISO}>
                {PUBLIC_DOC_LAST_UPDATED_LABEL}
              </time>
            </p>
          </div>
        </div>
      </header>

      <div className="page-shell grid gap-10 py-10 sm:py-14 lg:grid-cols-[260px_minmax(0,42rem)] lg:gap-16 xl:gap-24">
        <nav aria-label="Daftar isi" className="lg:sticky lg:top-24 lg:self-start">
          <details className="rounded-2xl bg-brand-surface px-4 py-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-brand-navy">
              Isi halaman ({sections.length} bagian)
            </summary>
            <div className="mt-3">{toc}</div>
          </details>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-brand-navy">Isi halaman</p>
            <div className="mt-3">{toc}</div>
          </div>
        </nav>

        <div className="min-w-0 space-y-12">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24"
              aria-labelledby={`${section.id}-heading`}
            >
              <h2
                id={`${section.id}-heading`}
                className="flex gap-3 font-heading text-xl font-semibold tracking-[-0.02em] text-brand-navy sm:text-2xl"
              >
                <span className="text-brand-blue" aria-hidden="true">{index + 1}.</span>
                <span>{section.title}</span>
              </h2>
              <div className="mt-4 space-y-4 text-[15px] leading-7 text-brand-navy/90 sm:text-base sm:leading-8">
                {section.blocks.map((block, blockIndex) => (
                  <DocBlock key={`${section.id}-${blockIndex}`} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

function DocBlock({ block }: { block: PublicDocBlock }) {
  switch (block.type) {
    case "p":
      return <p>{block.text}</p>;
    case "ul":
      return (
        <ul className="list-disc space-y-2 pl-5 marker:text-brand-blue">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal space-y-2 pl-5 marker:font-medium marker:text-brand-navy">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "note":
      return (
        <p className="rounded-xl border-l-4 border-brand-blue bg-[#FFF6C7] px-4 py-3 text-sm leading-7 text-brand-navy">
          {block.text}
        </p>
      );
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}
