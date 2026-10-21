import { CampusDirectory } from "@/components/staff/campus-directory";
import { StaffShell } from "@/components/staff/staff-shell";
import {
  listStaffCampusOptions,
  type CampusOptionStatus,
} from "@/lib/campus/service";
import { requireActiveStaff } from "@/lib/staff/authorization";
import { redirect } from "next/navigation";
import { Suspense } from "react";

const STATUSES: CampusOptionStatus[] = ["approved", "pending", "rejected"];

type Props = {
  searchParams: Promise<{ status?: string; state?: string }>;
};

async function OwnerCampusesContent({ searchParams }: Props) {
  const access = await requireActiveStaff();
  if (access.role !== "owner") {
    redirect("/admin/campuses");
  }

  const query = await searchParams;
  const selected = STATUSES.includes(query.status as CampusOptionStatus)
    ? (query.status as CampusOptionStatus)
    : undefined;

  let items: Awaited<ReturnType<typeof listStaffCampusOptions>> = [];
  let loadError: string | null = null;
  try {
    items = await listStaffCampusOptions(selected);
  } catch {
    loadError =
      "Katalog kampus belum tersedia. Terapkan migrasi campus_options, lalu muat ulang.";
  }

  return (
    <StaffShell role={access.role} current="campuses">
      <CampusDirectory
        items={items}
        selectedStatus={selected}
        basePath="/owner/campuses"
        state={query.state}
        loadError={loadError}
      />
    </StaffShell>
  );
}

export default function OwnerCampusesPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan katalog kampus...
          </p>
        </main>
      }
    >
      <OwnerCampusesContent {...props} />
    </Suspense>
  );
}
