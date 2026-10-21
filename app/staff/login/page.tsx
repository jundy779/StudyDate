import { AuthShell } from "@/components/auth/auth-shell";
import { StaffMagicLinkForm } from "@/components/staff/staff-magic-link-form";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getPostAuthenticationDestination } from "@/lib/staff/authorization";
import { hasEnvVars } from "@/lib/utils";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Masuk Tim | StudyDate ID",
  robots: { index: false, follow: false, nocache: true },
};

async function StaffLoginContent() {
  if (hasEnvVars) {
    const user = await getAuthenticatedUser();
    if (user) redirect(await getPostAuthenticationDestination(user));
  }
  return <AuthShell><StaffMagicLinkForm /></AuthShell>;
}

export default function StaffLoginPage() {
  return <Suspense fallback={<AuthShell><p className="text-sm text-brand-muted">Menyiapkan halaman masuk...</p></AuthShell>}><StaffLoginContent /></Suspense>;
}
