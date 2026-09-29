const STATUS_LABEL = {
  approved: "Disetujui",
  pending: "Usulan",
  rejected: "Ditolak",
} as const;

const SOURCE_LABEL = {
  seed: "Data awal",
  manual: "Usulan mahasiswa",
  staff: "Ditambahkan tim",
} as const;

const date = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export type CatalogItemStatus = keyof typeof STATUS_LABEL;
export type CatalogItemSource = keyof typeof SOURCE_LABEL;

export type CatalogItem = {
  id: string;
  name: string;
  status: CatalogItemStatus;
  source: CatalogItemSource;
  suggestionCount: number;
  lastSuggestedAt: string;
  suggestedBySuffix: string | null;
};

type OnboardingCatalogDirectoryProps = {
  title: string;
  description: string;
  entitySingular: string;
  addPlaceholder: string;
  items: CatalogItem[];
  selectedStatus?: CatalogItemStatus;
  basePath: string;
  state?: string;
  loadError?: string | null;
  action: (formData: FormData) => Promise<void>;
};

export function OnboardingCatalogDirectory({
  title,
  description,
  entitySingular,
  addPlaceholder,
  items,
  selectedStatus,
  basePath,
  state,
  loadError,
  action,
}: OnboardingCatalogDirectoryProps) {
  const pendingCount = items.filter((item) => item.status === "pending").length;
  const statuses = [
    { key: undefined, label: "Semua" },
    { key: "pending" as const, label: "Usulan" },
    { key: "approved" as const, label: "Disetujui" },
    { key: "rejected" as const, label: "Ditolak" },
  ];

  return (
    <div className="page-shell py-10 sm:py-14">
      <p className="section-label">Owner &amp; Admin</p>
      <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
        {title}
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-muted">
        {description}
      </p>
      <p className="mt-4 text-sm font-semibold text-brand-navy">
        Usulan menunggu: {pendingCount}
      </p>

      {state === "saved" && (
        <p
          role="status"
          className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          Perubahan {entitySingular} tersimpan.
        </p>
      )}
      {state === "invalid" && (
        <p
          role="status"
          className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-brand-error"
        >
          Nama {entitySingular} belum sesuai. Gunakan 2–120 karakter.
        </p>
      )}
      {state === "error" && (
        <p
          role="status"
          className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-brand-error"
        >
          Perubahan belum tersimpan. Coba lagi atau periksa apakah namanya sudah ada.
        </p>
      )}
      {loadError && (
        <p
          role="status"
          className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
        >
          {loadError}
        </p>
      )}

      <section className="mt-8 rounded-[22px] border border-brand-border bg-white p-5 sm:p-6">
        <h2 className="font-heading text-xl font-semibold">
          Tambah {entitySingular}
        </h2>
        <p className="mt-2 text-sm leading-6 text-brand-muted">
          Data yang ditambahkan langsung tersedia saat mahasiswa mengatur profil.
        </p>
        <form action={action} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input type="hidden" name="action" value="create" />
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            placeholder={addPlaceholder}
            className="focus-ring h-12 min-w-0 flex-1 rounded-xl border border-brand-border px-4"
          />
          <button
            type="submit"
            className="focus-ring min-h-12 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
          >
            Tambah
          </button>
        </form>
      </section>

      <nav
        aria-label={`Filter status ${entitySingular}`}
        className="mt-7 flex gap-2 overflow-x-auto pb-2"
      >
        {statuses.map((item) => {
          const href = item.key ? `${basePath}?status=${item.key}` : basePath;
          const active = selectedStatus === item.key;
          return (
            <a
              key={item.label}
              href={href}
              className={`focus-ring whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
                active
                  ? "bg-brand-navy text-white"
                  : "border border-brand-border bg-white text-brand-navy"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      <ul className="mt-6 space-y-4">
        {items.length === 0 && !loadError ? (
          <li className="rounded-[22px] border border-dashed border-brand-border bg-white px-5 py-8 text-sm text-brand-muted">
            Belum ada data untuk pilihan ini.
          </li>
        ) : null}
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-[22px] border border-brand-border bg-white p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-blue">
                  {STATUS_LABEL[item.status]} · {SOURCE_LABEL[item.source]}
                </p>
                <h3 className="mt-2 font-heading text-xl font-semibold text-brand-navy">
                  {item.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-brand-muted">
                  Diusulkan {item.suggestionCount}× · terakhir{" "}
                  {date.format(new Date(item.lastSuggestedAt))}
                  {item.suggestedBySuffix
                    ? ` · akun …${item.suggestedBySuffix}`
                    : ""}
                </p>
              </div>
            </div>

            <form
              action={action}
              className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="action" value="update" />
              <label className="min-w-0 flex-1 text-sm font-semibold">
                Edit nama
                <input
                  name="name"
                  defaultValue={item.name}
                  minLength={2}
                  maxLength={120}
                  required
                  className="focus-ring mt-2 h-11 w-full rounded-xl border border-brand-border px-3 font-normal"
                />
              </label>
              <button
                type="submit"
                className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy"
              >
                Simpan
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {item.status !== "approved" ? (
                <form action={action}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="action" value="approve" />
                  <input type="hidden" name="name" value={item.name} />
                  <button
                    type="submit"
                    className="focus-ring min-h-11 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white"
                  >
                    Setujui dan tampilkan
                  </button>
                </form>
              ) : null}
              {item.status === "pending" ? (
                <form action={action}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="action" value="reject" />
                  <button
                    type="submit"
                    className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy"
                  >
                    Tolak
                  </button>
                </form>
              ) : null}
              <form action={action}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="action" value="delete" />
                <button
                  type="submit"
                  className="focus-ring min-h-11 rounded-xl border border-red-200 px-4 text-sm font-semibold text-brand-error"
                >
                  Hapus
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
