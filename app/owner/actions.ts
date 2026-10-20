"use server";

import { requireOwner } from "@/lib/staff/authorization";
import { ownerSetVerificationRequirement } from "@/lib/staff/platform-settings";
import { getVerificationReadiness } from "@/lib/verification/readiness";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function setVerificationRequirementAction(formData: FormData) {
  await requireOwner();
  const value = formData.get("required");
  if (value !== "on" && value !== "off") {
    redirect("/owner?verifikasi=invalid#verification-requirement");
  }

  // Jangan wajibkan verifikasi kalau mahasiswa belum bisa menyelesaikannya,
  // karena semua akun akan terkunci dari fitur utama.
  if (value === "on") {
    const readiness = await getVerificationReadiness();
    if (!readiness.enabled || !readiness.manualCardReady) {
      redirect("/owner?verifikasi=not_ready#verification-requirement");
    }
  }

  const ok = await ownerSetVerificationRequirement(value === "on");
  revalidatePath("/owner");
  redirect(`/owner?verifikasi=${ok ? value : "failed"}#verification-requirement`);
}
