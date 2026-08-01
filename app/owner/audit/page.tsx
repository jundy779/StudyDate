import { StaffShell } from "@/components/staff/staff-shell";
import { requireOwner } from "@/lib/staff/authorization";
import { listStaffRoleEvents } from "@/lib/staff/service";
import { Suspense } from "react";

const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
async function AuditContent() {
  const access = await requireOwner();
  const events = await listStaffRoleEvents();
  return <StaffShell role={access.role} current="audit"><main className="min-h-svh bg-brand-surface"><div className="page-shell py-10 sm:py-14"><p className="section-label">Sanitized audit</p><h1 className="mt-4 font-heading text-4xl font-semibold">Riwayat perubahan staff</h1><div className="mt-8 overflow-hidden rounded-[22px] border border-brand-border bg-white"><div className="divide-y divide-brand-border">{events.length ? events.map((event, index) => <article key={`${event.created_at}-${index}`} className="grid gap-2 p-5 sm:grid-cols-[1fr_auto]"><div><p className="font-semibold">{event.event_type.replaceAll("_", " ")}</p><p className="mt-1 font-mono text-xs text-brand-muted">Target …{event.target_suffix ?? "deleted"} · actor …{event.actor_suffix ?? "deleted"}</p></div><time className="text-sm text-brand-muted">{date.format(new Date(event.created_at))}</time></article>) : <p className="p-6 text-brand-muted">Belum ada event staff.</p>}</div></div></div></main></StaffShell>;
}

export default function AuditPage() {
  return <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan audit…</p></main>}><AuditContent /></Suspense>;
}
