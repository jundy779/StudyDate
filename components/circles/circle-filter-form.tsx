import { CIRCLE_SCOPES, CIRCLE_TOPICS } from "@/lib/circles/constants";
import type { CircleFilters } from "@/lib/circles/validation";
import Link from "next/link";

export function CircleFilterForm({ filters }: { filters: CircleFilters }) {
  return (
    <form
      method="get"
      action="/app/circles"
      className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px_auto]"
    >
      <div>
        <label htmlFor="circle-search" className="text-sm font-semibold text-brand-navy">
          Cari nama Circle
        </label>
        <input
          id="circle-search"
          name="search"
          type="search"
          maxLength={80}
          defaultValue={filters.search}
          placeholder="Contoh: belajar TypeScript"
          className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-navy"
        />
      </div>
      <div>
        <label htmlFor="circle-topic" className="text-sm font-semibold text-brand-navy">
          Topik
        </label>
        <select
          id="circle-topic"
          name="topic"
          defaultValue={filters.topic ?? ""}
          className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-navy"
        >
          <option value="">Semua topik</option>
          {CIRCLE_TOPICS.map((topic) => (
            <option key={topic.value} value={topic.value}>
              {topic.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="circle-scope" className="text-sm font-semibold text-brand-navy">
          Cakupan
        </label>
        <select
          id="circle-scope"
          name="scope"
          defaultValue={filters.scope ?? ""}
          className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-navy"
        >
          <option value="">Semua cakupan</option>
          {CIRCLE_SCOPES.map((scope) => (
            <option key={scope.value} value={scope.value}>
              {scope.label}
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
          href="/app/circles"
          className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-muted"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
