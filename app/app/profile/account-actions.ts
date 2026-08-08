"use server";

import { PERMANENT_DELETE_CONFIRMATION } from "@/lib/account/lifecycle-constants";
import {
  deactivateMyStudentAccount,
  permanentlyDeleteMyStudentAccount,
  reactivateMyStudentAccount,
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

export async function permanentlyDeleteStudentAccountAction(
  confirmation: string,
): Promise<{ ok: false; message: string } | void> {
  try {
    await permanentlyDeleteMyStudentAccount(confirmation);
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Confirmation mismatch."
        ? `Ketik ${PERMANENT_DELETE_CONFIRMATION} persis untuk mengonfirmasi.`
        : "Penghapusan gagal. Coba lagi atau hubungi Bantuan.";
    return { ok: false as const, message };
  }
  redirect("/?account=deleted");
}
