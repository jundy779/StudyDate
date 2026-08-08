import { submitCampusManage } from "@/app/staff/campus-actions";
import { OnboardingCatalogDirectory } from "@/components/staff/onboarding-catalog-directory";
import type { StaffCampusOption } from "@/lib/campus/service";

type CampusDirectoryProps = {
  items: StaffCampusOption[];
  selectedStatus?: StaffCampusOption["status"];
  basePath: "/owner/campuses" | "/admin/campuses";
  state?: string;
  loadError?: string | null;
};

export function CampusDirectory(props: CampusDirectoryProps) {
  return (
    <OnboardingCatalogDirectory
      title="Katalog kampus"
      description="Kelola daftar kampus onboarding: tambah, edit, setujui usulan manual user, atau hapus. Usulan muncul saat mahasiswa mengisi kampus di luar daftar resmi."
      entitySingular="kampus"
      addPlaceholder="Contoh: Universitas Contoh"
      items={props.items}
      selectedStatus={props.selectedStatus}
      basePath={props.basePath}
      state={props.state}
      loadError={props.loadError}
      action={submitCampusManage}
    />
  );
}
