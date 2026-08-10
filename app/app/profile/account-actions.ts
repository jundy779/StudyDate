"use server";

import { ACCOUNT_DELETE_CONFIRMATION } from "@/lib/account/lifecycle-constants";
import {
  deactivateMyStudentAccount,
  reactivateMyStudentAccount,
  requestMyStudentAccountDeletion,
} from "@/lib/account/lifecycle";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deactivateStudentAccountAction(): Promise<
  { ok: false; message: string } | void
> {
  try {
    await deactivateMyStudentAccount();
  } catch {
    return {
      ok: false as const,
      message: "Akun belum dapat dinonaktifkan. Coba lagi beberapa saat.",
    };
  }
  redirect("/account/reactivate");
}

export async function reactivateStudentAccountAction(): Promise<void> {
  try {
    await reactivateMyStudentAccount();
  } catch {
    redirect("/account/reactivate?error=reactivate");
  }
  revalidatePath("/app");
  redirect("/app");
}

export async function requestStudentAccountDeletionAction(
  confirmation: string,
): Promise<{ ok: false; message: string } | void> {
  try {
    await requestMyStudentAccountDeletion(confirmation);
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Confirmation mismatch."
        ? `Ketik ${ACCOUNT_DELETE_CONFIRMATION} persis untuk mengonfirmasi.`
        : "Permintaan penghapusan belum dapat diproses. Coba lagi atau hubungi Bantuan.";
    return { ok: false as const, message };
  }
  redirect("/account/deletion-pending");
}
