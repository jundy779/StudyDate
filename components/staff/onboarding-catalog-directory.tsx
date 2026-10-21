import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import {
  EmptyState,
  HelpTip,
  Notice,
  Panel,
  StaffPage,
  StatusChip,
  staffButton,
  staffField,
} from "@/components/staff/ui";
import Link from "next/link";

const STATUS_LABEL = {
  approved: "Tampil di pilihan",
  pending: "Usulan baru",
  rejected: "Ditolak",
} as const;

const STATUS_TONE = {
  approved: "go",
  pending: "wait",
  rejected: "muted",
} as const;

const SOURCE_LABEL = {
  seed: "Data awal",
  manual: "Diusulkan mahasiswa",
  staff: "Ditambahkan tim",
} as const;

const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

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
  const filters = [
    { key: undefined, label: "Semua" },
    { key: "pending" as const, label: "Usulan baru" },
    { key: "approved" as const, label: "Tampil di pilihan" },
    { key: "rejected" as const, label: "Ditolak" },
  ];

  return (
    <StaffPage
      kicker="Pilihan saat mendaftar"
      title={title}
      description={description}
      mascot="mikir"
    >
      {state === "saved" ? <Notice tone="success">Perubahan {entitySingular} tersimpan.</Notice> : null}
      {state === "invalid" ? (
        <Notice tone="danger">Nama {entitySingular} belum sesuai. Pakai 2 sampai 120 karakter.</Notice>
      ) : null}
      {state === "error" ? (
        <Notice tone="danger">
          Perubahan belum tersimpan. Coba lagi, atau periksa apakah namanya sudah ada.
        </Notice>
      ) : null}
      {loadError ? <Notice tone="warn">{loadError}</Notice> : null}

      {pendingCount > 0 && selectedStatus !== "pending" ? (
        <Notice tone="warn" title={`${pendingCount} usulan baru menunggu`}>
          Mahasiswa mengetik nama {entitySingular} yang belum ada di daftar.{" "}
          <Link href={`${basePath}?status=pending`} className="font-semibold underline underline-offset-4">
            Lihat usulan
          </Link>
        </Notice>
      ) : null}

      <Panel
        title={`Tambah ${entitySingular}`}
        description="Nama yang ditambahkan langsung muncul di pilihan saat mahasiswa mengisi profil."
      >
        <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="action" value="create" />
          <label className="min-w-0 flex-1 text-sm font-semibold text-brand-navy">
            Nama {entitySingular}
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              placeholder={addPlaceholder}
              className={staffField}
            />
          </label>
          <button type="submit" className={staffButton.primary}>
            Tambah
          </button>
        </form>
      </Panel>

      <Panel
        title={`Daftar ${entitySingular}`}
        description={`${items.length} ${entitySingular} pada pilihan ini.`}
        quiet
      >
        <nav aria-label={`Saring daftar ${entitySingular}`} className="mb-5 flex flex-wrap gap-2">
          {filters.map((item) => {
            const href = item.key ? `${basePath}?status=${item.key}` : basePath;
            const active = selectedStatus === item.key;
            return (
              <Link
                key={item.label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`focus-ring inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${
                  active
                    ? "border-2 border-brand-navy bg-brand-navy text-white"
                    : "border border-brand-border bg-white text-brand-navy hover:border-brand-navy"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {items.length === 0 && !loadError ? (
          <EmptyState title="Belum ada data untuk pilihan ini" expression="ngantuk">
            Coba pilih &ldquo;Semua&rdquo;, atau tambahkan {entitySingular} baru di atas.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {items.map((item) => (
              <li key={item.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words font-semibold text-brand-navy">{item.name}</h3>
                    <StatusChip tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</StatusChip>
                  </div>
                  <p className="mt-1 text-sm text-brand-muted">
                    {SOURCE_LABEL[item.source]}
                    {item.source === "manual"
                      ? ` · diusulkan ${item.suggestionCount} kali, terakhir ${date.format(new Date(item.lastSuggestedAt))}`
                      : ""}
                  </p>
                  <details className="mt-2">
                    <summary className="focus-ring inline-flex min-h-9 cursor-pointer list-none items-center rounded-lg text-sm font-semibold text-brand-blue">
                      Ubah nama
                    </summary>
                    <form action={action} className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="action" value="update" />
                      <label className="min-w-0 flex-1 text-sm font-semibold text-brand-navy">
                        Nama baru
                        <input
                          name="name"
                          defaultValue={item.name}
                          minLength={2}
                          maxLength={120}
                          required
                          className={staffField}
                        />
                      </label>
                      <button type="submit" className={staffButton.quiet}>
                        Simpan nama
                      </button>
                    </form>
                  </details>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {item.status !== "approved" ? (
                    <form action={action}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="action" value="approve" />
                      <input type="hidden" name="name" value={item.name} />
                      <button type="submit" className={staffButton.primary}>
                        Setujui dan tampilkan
                      </button>
                    </form>
                  ) : null}
                  {item.status === "pending" ? (
                    <form action={action}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="action" value="reject" />
                      <button type="submit" className={staffButton.quiet}>
                        Tolak
                      </button>
                    </form>
                  ) : null}
                  <form action={action}>
                    <input type="hidden" name="id" value={item.id} />
                    <ConfirmSubmitButton
                      name="action"
                      value="delete"
                      triggerLabel="Hapus"
                      title={`Hapus ${item.name}?`}
                      description={`Nama ini hilang dari pilihan saat mendaftar. Profil yang sudah memakainya tidak ikut berubah.`}
                      confirmLabel="Ya, hapus"
                      className={staffButton.dangerQuiet}
                    />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <HelpTip label="Dari mana usulan baru datang?">
            Saat mendaftar, mahasiswa boleh mengetik nama {entitySingular} yang belum ada di daftar.
            Nama itu masuk sebagai usulan. Setujui kalau namanya benar dan resmi, supaya mahasiswa lain
            bisa memilihnya. Tolak kalau salah ketik atau tidak jelas.
          </HelpTip>
        </div>
      </Panel>
    </StaffPage>
  );
}
