import { SocialIcon } from "@/components/brand/social-icon";
import { StaffShell } from "@/components/staff/staff-shell";
import { saveContactLinkAction } from "@/app/owner/contact/actions";
import { ownerListContactLinks } from "@/lib/marketing/contact-links";
import {
  CONTACT_LINK_KINDS,
  CONTACT_LINK_META,
  type ContactLinkKind,
} from "@/lib/marketing/contact-links-config";
import { requireOwner } from "@/lib/staff/authorization";
import { Suspense } from "react";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const stateMessages: Record<string, string> = {
  saved: "Tautan tersimpan.",
  removed: "Tautan dihapus dari situs.",
  bad_url: "Alamat belum sesuai. Gunakan alamat resmi platform tersebut, diawali https:// (atau mailto: untuk email).",
  failed: "Belum tersimpan. Pastikan migration kontak publik sudah terpasang, lalu coba lagi.",
  invalid: "Pilihan kanal tidak dikenali.",
};

async function ContactContent({ searchParams }: PageProps) {
  const access = await requireOwner();
  const [links, query] = await Promise.all([ownerListContactLinks(), searchParams]);
  const state = typeof query.state === "string" ? query.state : undefined;
  const stateKind = typeof query.kind === "string" ? query.kind : undefined;
  const byKind = new Map((links ?? []).map((link) => [link.kind, link]));

  return (
    <StaffShell role={access.role} current="overview" access={access}>
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Area Owner</p>
          <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Media sosial dan kontak
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-muted">
            Isi alamat akun resmi StudyDate. Hanya tautan yang diisi dan dicentang
            &ldquo;Tampilkan&rdquo; yang muncul di footer situs.
          </p>

          {links === null ? (
            <p role="status" className="mt-8 rounded-2xl bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950">
              Fitur ini belum aktif di database. Pasang migration
              {" "}<code className="font-mono">202610200002_public_contact_links_v1.sql</code>{" "}
              lalu muat ulang halaman ini.
            </p>
          ) : null}

          {state && !stateKind ? (
            <p role="status" className="mt-6 rounded-xl bg-white px-4 py-3 text-sm text-brand-navy">
              {stateMessages[state]}
            </p>
          ) : null}

          <ul className="mt-10 grid gap-4 lg:grid-cols-2">
            {CONTACT_LINK_KINDS.map((kind: ContactLinkKind) => {
              const meta = CONTACT_LINK_META[kind];
              const current = byKind.get(kind);
              const message = stateKind === kind && state ? stateMessages[state] : null;
              return (
                <li key={kind} id={kind} className="scroll-mt-8 rounded-[22px] border border-brand-border bg-white p-5 sm:p-6">
                  <form action={saveContactLinkAction}>
                    <input type="hidden" name="kind" value={kind} />
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-navy text-white">
                        <SocialIcon kind={kind} />
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-heading text-lg font-semibold text-brand-navy">{meta.label}</h2>
                        <p className="text-sm text-brand-muted">{meta.hint}</p>
                      </div>
                    </div>
                    <label htmlFor={`url-${kind}`} className="mt-5 block text-sm font-semibold text-brand-navy">
                      Alamat
                    </label>
                    <input
                      id={`url-${kind}`}
                      name="url"
                      type="text"
                      inputMode="url"
                      defaultValue={current?.url ?? ""}
                      placeholder={meta.placeholder}
                      disabled={links === null}
                      className="focus-ring mt-2 h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-navy placeholder:text-brand-muted/70"
                    />
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm text-brand-navy">
                        <input
                          type="checkbox"
                          name="isVisible"
                          defaultChecked={current?.isVisible ?? false}
                          disabled={links === null}
                          className="h-4 w-4 accent-brand-blue"
                        />
                        Tampilkan di situs
                      </label>
                      <button
                        type="submit"
                        disabled={links === null}
                        className="focus-ring min-h-11 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Simpan
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-brand-muted">
                      Kosongkan alamat lalu simpan untuk menghapus.
                    </p>
                    {message ? (
                      <p role="status" className="mt-3 rounded-xl bg-brand-surface px-3 py-2 text-sm text-brand-navy">
                        {message}
                      </p>
                    ) : null}
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </StaffShell>
  );
}

export default function OwnerContactPage(props: PageProps) {
  return (
    <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan halaman…</p></main>}>
      <ContactContent {...props} />
    </Suspense>
  );
}
