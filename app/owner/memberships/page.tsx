import {
  grantPlusMembership,
  lookupMembership,
  revokePlusMembership,
} from "@/app/owner/memberships/actions";
import { StaffShell } from "@/components/staff/staff-shell";
import { MEMBERSHIP_GRANT_DAYS } from "@/lib/membership/limits";
import { lookupMembershipByEmail } from "@/lib/membership/service";
import { requireOwner } from "@/lib/staff/authorization";
import { Suspense } from "react";

type Props = {
  searchParams: Promise<{ email?: string; state?: string }>;
};

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const stateMessage: Record<string, string> = {
  saved: "Perubahan paket tersimpan.",
  error: "Perubahan paket belum dapat disimpan.",
  invalid: "Input tidak valid.",
  not_found: "Tidak ada akun Auth dengan email itu.",
  unchanged: "Tidak ada paket Plus aktif untuk dicabut.",
};

async function MembershipsContent({ searchParams }: Props) {
  const access = await requireOwner();
  const query = await searchParams;
  const email = query.email?.trim().toLowerCase() || "";
  const message = query.state ? stateMessage[query.state] : null;
  const record = email ? await lookupMembershipByEmail(email) : null;
  const isError =
    query.state === "error" ||
    query.state === "invalid" ||
    query.state === "not_found";

  return (
    <StaffShell role={access.role} current="memberships" access={access}>
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Owner only</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">
            Membership
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-brand-muted">
            Grant Plus terbatas untuk uji Owner. Pembayaran belum ada. Cari akun
            lewat email Auth, tanpa UUID mentah.
          </p>

          {message ? (
            <p
              role="status"
              className={`mt-6 rounded-xl px-4 py-3 text-sm font-semibold ${
                isError ? "bg-red-50 text-brand-error" : "bg-green-50 text-brand-success"
              }`}
            >
              {message}
            </p>
          ) : null}

          <form
            action={lookupMembership}
            className="mt-8 grid gap-4 rounded-[22px] border border-brand-border bg-white p-6 sm:grid-cols-[1fr_auto] sm:items-end"
          >
            <label className="text-sm font-semibold">
              Email akun Auth
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                defaultValue={email}
                className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
                autoComplete="off"
              />
            </label>
            <button className="focus-ring min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">
              Cari paket
            </button>
          </form>

          {email && !record ? (
            <p className="mt-6 text-sm text-brand-muted">
              Tidak ada akun yang cocok untuk email itu.
            </p>
          ) : null}

          {record ? (
            <section className="mt-8 rounded-[22px] border border-brand-border bg-white p-6">
              <p className="font-semibold text-brand-navy">{record.public_alias}</p>
              <p className="mt-2 text-sm text-brand-muted">
                Paket: {record.plan_code === "plus" ? "StudyDate Plus" : "StudyDate Free"}
              </p>
              {record.ends_at ? (
                <p className="mt-1 text-sm text-brand-muted">
                  Berlaku sampai {dateFmt.format(new Date(record.ends_at))}
                </p>
              ) : null}
              {record.starts_at ? (
                <p className="mt-1 text-sm text-brand-muted">
                  Mulai {dateFmt.format(new Date(record.starts_at))}
                </p>
              ) : null}
              {record.status ? (
                <p className="mt-1 text-sm text-brand-muted">
                  Status: {record.status}
                </p>
              ) : null}
              {record.source ? (
                <p className="mt-1 text-sm text-brand-muted">
                  Sumber:{" "}
                  {record.source === "owner_grant"
                    ? "Grant Owner"
                    : record.source === "promo"
                      ? "Promo"
                      : record.source === "early_access_promo"
                        ? "Promo Akses Awal"
                        : record.source === "system"
                          ? "Sistem"
                          : "Cadangan pembayaran (tidak aktif)"}
                </p>
              ) : null}

              <form
                action={grantPlusMembership}
                className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
              >
                <input type="hidden" name="email" value={email} />
                <label className="text-sm font-semibold">
                  Durasi grant
                  <select
                    name="durationDays"
                    defaultValue="7"
                    className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
                  >
                    {MEMBERSHIP_GRANT_DAYS.map((days) => (
                      <option key={days} value={days}>
                        {days} hari
                      </option>
                    ))}
                  </select>
                </label>
                <button className="focus-ring min-h-11 rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white">
                  Grant StudyDate Plus
                </button>
              </form>
              {record.plan_code === "plus" ? (
                <form action={revokePlusMembership} className="mt-4">
                  <input type="hidden" name="email" value={email} />
                  <button className="focus-ring min-h-11 rounded-xl border border-brand-border px-5 text-sm font-semibold">
                    Cabut Plus
                  </button>
                </form>
              ) : null}
            </section>
          ) : null}
        </div>
      </main>
    </StaffShell>
  );
}

export default function OwnerMembershipsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan membership…</p>
        </main>
      }
    >
      <MembershipsContent {...props} />
    </Suspense>
  );
}
