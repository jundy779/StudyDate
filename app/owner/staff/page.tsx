import { updateStaffMember } from "@/app/owner/staff/actions";
import { StaffHeader } from "@/components/staff/staff-header";
import { requireOwner } from "@/lib/staff/authorization";
import { listStaffMembers } from "@/lib/staff/service";
import { Suspense } from "react";

type Props = { searchParams: Promise<{ state?: string }> };
const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

async function StaffContent({ searchParams }: Props) {
  const access = await requireOwner();
  const [members, query] = await Promise.all([listStaffMembers(), searchParams]);
  return (
    <main className="min-h-svh bg-brand-surface"><StaffHeader role={access.role} current="staff" /><div className="page-shell py-10 sm:py-14">
      <p className="section-label">Owner only</p><h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">Staff management</h1>
      <p className="mt-4 max-w-2xl leading-7 text-brand-muted">Tambahkan hanya akun Auth yang sudah ada menggunakan UUID. Email dan password tidak disimpan di tabel staff.</p>
      {query.state && <p role="status" className={`mt-6 rounded-xl px-4 py-3 text-sm font-semibold ${query.state === "saved" ? "bg-green-50 text-brand-success" : "bg-red-50 text-brand-error"}`}>{query.state === "saved" ? "Perubahan staff tersimpan. Login ulang diperlukan untuk claim baru." : "Perubahan belum dapat disimpan."}</p>}
      <form action={updateStaffMember} className="mt-8 grid gap-4 rounded-[22px] border border-brand-border bg-white p-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-sm font-semibold">UUID akun Auth<input name="targetUserId" required pattern="[0-9a-fA-F-]{36}" className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 font-mono text-sm" placeholder="UUID akun yang sudah ada" /></label>
        <input type="hidden" name="action" value="grant_admin" /><button className="focus-ring min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">Tambahkan admin reviewer</button>
      </form>
      <section className="mt-8 overflow-hidden rounded-[22px] border border-brand-border bg-white" aria-labelledby="staff-list"><div className="border-b border-brand-border p-5"><h2 id="staff-list" className="font-heading text-xl font-semibold">Staff terdaftar</h2></div><div className="divide-y divide-brand-border">{members.map((member) => <article key={member.user_id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="font-semibold capitalize">{member.role} · {member.status}</p><p className="mt-1 font-mono text-xs text-brand-muted">UUID suffix {member.user_id.slice(-8)} · dibuat {date.format(new Date(member.created_at))}</p><p className="mt-1 text-sm text-brand-muted">Reviewer: {member.verification_reviewer ? "Aktif" : "Nonaktif"}</p></div>{member.role === "admin" && <div className="flex flex-wrap gap-2">{member.status === "active" ? <><form action={updateStaffMember}><input type="hidden" name="targetUserId" value={member.user_id} /><input type="hidden" name="action" value={member.verification_reviewer ? "remove_reviewer" : "grant_reviewer"} /><button className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold">{member.verification_reviewer ? "Cabut reviewer" : "Aktifkan reviewer"}</button></form><form action={updateStaffMember}><input type="hidden" name="targetUserId" value={member.user_id} /><input type="hidden" name="action" value="deactivate_admin" /><button className="focus-ring min-h-11 rounded-xl border border-brand-error px-4 text-sm font-semibold text-brand-error">Nonaktifkan</button></form></> : <form action={updateStaffMember}><input type="hidden" name="targetUserId" value={member.user_id} /><input type="hidden" name="action" value="reactivate_admin" /><button className="focus-ring min-h-11 rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white">Aktifkan kembali</button></form>}</div>}</article>)}</div></section>
    </div></main>
  );
}

export default function StaffPage(props: Props) {
  return <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan staff management…</p></main>}><StaffContent {...props} /></Suspense>;
}
