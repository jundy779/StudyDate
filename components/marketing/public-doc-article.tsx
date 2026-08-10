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
  return (
    <article className="page-shell py-10 sm:py-14 lg:py-16">
      <div className="mx-auto max-w-[42rem]">
        <p className="section-label">{eyebrow}</p>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl lg:text-[2.65rem] lg:leading-[1.15]">
          {title}
        </h1>
        <p className="mt-4 text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
          {intro}
        </p>
        <p className="mt-5 text-sm text-brand-muted">
          Terakhir diperbarui:{" "}
          <time dateTime={PUBLIC_DOC_LAST_UPDATED_ISO}>
            {PUBLIC_DOC_LAST_UPDATED_LABEL}
          </time>
        </p>

        <nav
          className="mt-8 rounded-2xl border border-brand-border bg-brand-surface/70 px-5 py-4"
          aria-label="Daftar isi"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
            Isi halaman
          </p>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-brand-navy">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="focus-ring rounded-sm underline-offset-4 hover:underline"
                >
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-12">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24"
              aria-labelledby={`${section.id}-heading`}
            >
              <h2
                id={`${section.id}-heading`}
                className="font-heading text-xl font-semibold tracking-[-0.02em] text-brand-navy sm:text-2xl"
              >
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-[15px] leading-7 text-brand-navy/90 sm:text-base sm:leading-8">
                {section.blocks.map((block, index) => (
                  <DocBlock key={`${section.id}-${index}`} block={block} />
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
        <p className="rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm leading-7 text-brand-navy/85">
          {block.text}
        </p>
      );
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}
