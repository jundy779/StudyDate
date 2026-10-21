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
      title="Daftar kampus"
      description="Pilihan kampus yang muncul saat mahasiswa mengisi profil. Tambah, ubah nama, setujui usulan, atau hapus dari sini."
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
