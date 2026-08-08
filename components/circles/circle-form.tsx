import {
  CIRCLE_DESCRIPTION_MAX,
  CIRCLE_DESCRIPTION_MIN,
  CIRCLE_MEMBER_MAX,
  CIRCLE_MEMBER_MIN,
  CIRCLE_NAME_MAX,
  CIRCLE_NAME_MIN,
  CIRCLE_SCOPES,
  CIRCLE_TOPICS,
} from "@/lib/circles/constants";
import type { CircleDetail } from "@/lib/circles/service";

export function CircleForm({
  action,
  circle,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  circle?: CircleDetail;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-7">
      {circle ? (
        <>
          <input type="hidden" name="publicSlug" value={circle.public_slug} />
          <input type="hidden" name="scope" value={circle.scope} />
        </>
      ) : null}
      <div>
        <label htmlFor="circle-name" className="text-sm font-semibold text-brand-navy">
          Nama Circle
        </label>
        <input
          id="circle-name"
          name="name"
          required
          minLength={CIRCLE_NAME_MIN}
          maxLength={CIRCLE_NAME_MAX}
          defaultValue={circle?.name}
          aria-describedby="circle-name-help"
          className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
        />
        <p id="circle-name-help" className="mt-2 text-xs leading-5 text-brand-muted">
          {CIRCLE_NAME_MIN}–{CIRCLE_NAME_MAX} karakter, tanpa HTML atau kontak.
        </p>
      </div>
      <div>
        <label
          htmlFor="circle-description"
          className="text-sm font-semibold text-brand-navy"
        >
          Deskripsi singkat
        </label>
        <textarea
          id="circle-description"
          name="description"
          required
          rows={6}
          minLength={CIRCLE_DESCRIPTION_MIN}
          maxLength={CIRCLE_DESCRIPTION_MAX}
          defaultValue={circle?.description}
          aria-describedby="circle-description-help"
          className="focus-ring mt-2 w-full resize-y rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6 text-brand-navy"
        />
        <p
          id="circle-description-help"
          className="mt-2 text-xs leading-5 text-brand-muted"
        >
          Jelaskan topik dan tujuan belajar. Jangan cantumkan email, nomor telepon,
          atau akun sosial.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="circle-topic" className="text-sm font-semibold text-brand-navy">
            Topik
          </label>
          <select
            id="circle-topic"
            name="topic"
            required
            defaultValue={circle?.topic ?? "general"}
            className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
          >
            {CIRCLE_TOPICS.map((topic) => (
              <option key={topic.value} value={topic.value}>
                {topic.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="circle-member-limit"
            className="text-sm font-semibold text-brand-navy"
          >
            Batas anggota
          </label>
          <input
            id="circle-member-limit"
            name="memberLimit"
            type="number"
            required
            min={CIRCLE_MEMBER_MIN}
            max={CIRCLE_MEMBER_MAX}
            defaultValue={circle?.member_limit ?? 12}
            className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy"
          />
        </div>
      </div>
      <fieldset disabled={Boolean(circle)}>
        <legend className="text-sm font-semibold text-brand-navy">Cakupan</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {CIRCLE_SCOPES.map((scope) => (
            <label
              key={scope.value}
              className="focus-within:ring-brand-blue/40 rounded-xl border border-brand-border bg-white p-4 focus-within:ring-2"
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="scope"
                  value={scope.value}
                  defaultChecked={(circle?.scope ?? "open") === scope.value}
                  className="mt-1 h-4 w-4 accent-brand-blue"
                />
                <span>
                  <span className="block text-sm font-semibold text-brand-navy">
                    {scope.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-brand-muted">
                    {scope.description}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="border-t border-brand-border pt-6">
        <button
          type="submit"
          className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-blue px-6 text-sm font-semibold text-white sm:w-auto"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
