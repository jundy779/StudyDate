import { requireVerificationReviewer } from "@/lib/staff/authorization";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function AdminContent() {
  await requireVerificationReviewer();
  return redirect("/admin/verifications");
}

export default function AdminPage() {
  return <Suspense fallback={<main className="min-h-svh bg-brand-surface"><p className="page-shell py-10 text-brand-muted">Menyiapkan admin…</p></main>}><AdminContent /></Suspense>;
}
