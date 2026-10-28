import { Award, Star } from "lucide-react";
import Link from "next/link";

type PendingFeedback = { public_slug: string; title: string; ends_at: string; timezone_name: string };

export function PendingFeedbackStrip({ events }: { events: PendingFeedback[] }) {
  return (
    <section aria-labelledby="pending-feedback-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p id="pending-feedback-title" className="font-hand text-xl text-brand-blue">
          {events.length ? "Gimana acaranya kemarin?" : "Setelah acara"}
        </p>
        <Link
          href="/app/certificates"
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-brand-navy hover:text-brand-blue"
        >
          <Award className="h-4 w-4" aria-hidden="true" />
          Sertifikatku
        </Link>
      </div>
      {events.length ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <li key={event.public_slug}>
              <Link
                href={`/app/events/${event.public_slug}#ulasan`}
                className="focus-ring group flex h-full items-center gap-3 rounded-2xl border border-brand-border bg-white p-4 transition-colors hover:border-brand-navy"
              >
                <Star className="h-6 w-6 shrink-0 fill-[#FFC83D] text-brand-navy" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block break-words font-semibold text-brand-navy group-hover:text-brand-blue">
                    {event.title}
                  </span>
                  <span className="text-xs text-brand-muted">Beri ulasan, cuma butuh semenit</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
