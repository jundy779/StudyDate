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
      description="Kelola pilihan kampus yang tersedia saat mahasiswa mengatur profil. Kamu dapat menambah, mengubah, menyetujui usulan mahasiswa, atau menghapus data."
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
