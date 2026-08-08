import {
  EVENT_CATEGORIES,
  EVENT_SCOPES,
} from "@/lib/events/constants";
import type { EventFilters } from "@/lib/events/validation";
import Link from "next/link";

const categoryLabels: Record<(typeof EVENT_CATEGORIES)[number], string> = {
  study_together: "Belajar Bareng",
  coding_tech: "Coding / Tech",
  design: "Desain",
  languages: "Bahasa",
  thesis: "Skripsi / Tesis",
  exam_prep: "Persiapan Ujian",
  workshop: "Workshop",
  discussion: "Diskusi",
  networking: "Networking",
  community: "Komunitas",
  other: "Lainnya",
};

export function EventFilterForm({ filters }: { filters: EventFilters }) {
  return (
    <form
      method="get"
      action="/app/events"
      className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px_auto]"
    >
      <div>
        <label htmlFor="event-search" className="text-sm font-semibold text-brand-navy">
          Cari judul Event
        </label>
        <input
          id="event-search"
          name="search"
          type="search"
          maxLength={100}
          defaultValue={filters.search}
          placeholder="Contoh: workshop portofolio"
          className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-navy"
        />
      </div>
      <div>
        <label htmlFor="event-category-filter" className="text-sm font-semibold text-brand-navy">
          Kategori
        </label>
        <select
          id="event-category-filter"
          name="category"
          defaultValue={filters.category ?? ""}
          className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-navy"
        >
          <option value="">Semua kategori</option>
          {EVENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {categoryLabels[category]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="event-scope-filter" className="text-sm font-semibold text-brand-navy">
          Cakupan
        </label>
        <select
          id="event-scope-filter"
          name="scope"
          defaultValue={filters.scope ?? ""}
          className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-navy"
        >
          <option value="">Semua cakupan</option>
          {EVENT_SCOPES.map((scope) => (
            <option key={scope} value={scope}>
              {scope === "open" ? "Terbuka untuk StudyDate" : "Kampus yang sama"}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="focus-ring inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white"
        >
          Terapkan
        </button>
        <Link
          href="/app/events"
          className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-muted"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
