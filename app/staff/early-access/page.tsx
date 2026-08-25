import {
  EarlyAccessQueue,
  type EarlyAccessQueueSearchParams,
} from "@/components/staff/early-access-queue";
import { StaffShell } from "@/components/staff/staff-shell";
import { requireStaffCapability } from "@/lib/staff/authorization";
import { Suspense } from "react";

type Props = {
  searchParams: Promise<EarlyAccessQueueSearchParams>;
};

async function EarlyAccessContent({ searchParams }: Props) {
  const access = await requireStaffCapability("early_access.read");
  const query = await searchParams;

  return (
    <StaffShell role={access.role} current="early-access" access={access}>
      <EarlyAccessQueue
        access={access}
        query={query}
        basePath="/staff/early-access"
      />
    </StaffShell>
  );
}

export default function EarlyAccessOpsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan antrean Akses Awal…
          </p>
        </main>
      }
    >
      <EarlyAccessContent {...props} />
    </Suspense>
  );
}
