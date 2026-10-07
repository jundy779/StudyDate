import { CONNECTION_GOALS, INTERESTS } from "@/lib/people/constants";
import type { PeopleFilters } from "@/lib/people/validation";
import { Search } from "lucide-react";
import Link from "next/link";

type PeopleFilterFormProps = {
  filters: Omit<PeopleFilters, "after">;
  advancedEnabled?: boolean;
};

const inputClass =
  "focus-ring min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-navy placeholder:text-brand-muted";

export function PeopleFilterForm({
  filters,
  advancedEnabled = false,
}: PeopleFilterFormProps) {
  return (
    <form action="/app/people" method="get" className="mt-6" aria-label="Pilihan pencarian teman">
      <input type="hidden" name="order" value={filters.order ?? "shared"} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold text-brand-navy">
          Kampus
          <input className={`${inputClass} mt-2`} name="campus" defaultValue={filters.campus} placeholder="Cari kampus" maxLength={120} />
        </label>
        <label className="text-sm font-semibold text-brand-navy">
          Program studi
          <input className={`${inputClass} mt-2`} name="program" defaultValue={filters.program} placeholder="Cari program studi" maxLength={120} />
        </label>
        <label className="text-sm font-semibold text-brand-navy">
          Semester
          <select
            className={`${inputClass} mt-2`}
            name="semester"
            defaultValue={advancedEnabled ? (filters.semester ?? "") : ""}
            disabled={!advancedEnabled}
          >
            <option value="">Semua semester</option>
            {Array.from({ length: 16 }, (_, index) => index + 1).map((semester) => (
              <option key={semester} value={semester}>Semester {semester}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-brand-navy">
          Kota/Kabupaten
          <input
            className={`${inputClass} mt-2`}
            name="city"
            defaultValue={advancedEnabled ? filters.city : ""}
            placeholder="Cari wilayah"
            maxLength={120}
            disabled={!advancedEnabled}
          />
        </label>
        <label className="text-sm font-semibold text-brand-navy sm:col-span-1 lg:col-span-2">
          Tujuan koneksi
          <select
            className={`${inputClass} mt-2`}
            name="goal"
            defaultValue={advancedEnabled ? (filters.goal ?? "") : ""}
            disabled={!advancedEnabled}
          >
            <option value="">Semua tujuan</option>
            {CONNECTION_GOALS.map((goal) => <option key={goal.value} value={goal.value}>{goal.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-brand-navy sm:col-span-1 lg:col-span-2">
          Minat
          <select
            className={`${inputClass} mt-2`}
            name="interest"
            defaultValue={advancedEnabled ? (filters.interest ?? "") : ""}
            disabled={!advancedEnabled}
          >
            <option value="">Semua minat</option>
            {INTERESTS.map((interest) => <option key={interest.value} value={interest.value}>{interest.label}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">
          <Search className="h-4 w-4" aria-hidden="true" /> Tampilkan hasil
        </button>
        <Link href="/app/people" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border bg-white px-5 text-sm font-semibold text-brand-navy">
          Hapus pilihan
        </Link>
      </div>
      {!advancedEnabled ? (
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          Pilihan semester, kota, tujuan, dan minat tersedia di StudyDate Plus.{" "}
          <Link
            href="/app/membership"
            className="focus-ring font-semibold text-brand-blue underline-offset-2 hover:underline"
          >
            Lihat paket
          </Link>
          .
        </p>
      ) : null}
    </form>
  );
}
