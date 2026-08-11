import { VerificationForm } from "@/components/verification/verification-form";

export const instant = false;

export default function VerificationAuditPage() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return (
    <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <div className="page-shell py-8 sm:py-12">
        <p className="section-label">Local verification audit</p>
        <h1 className="mt-4 font-heading text-3xl font-semibold">
          PDDIKTI lookup dan fallback manual
        </h1>
        <div className="mt-8 max-w-3xl">
          <VerificationForm />
        </div>
      </div>
    </main>
  );
}
