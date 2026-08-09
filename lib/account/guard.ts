import "server-only";

import {
  getMyAccountDeletionStatus,
  getStudentDeactivatedAt,
} from "@/lib/account/lifecycle";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getCurrentStaffAccess } from "@/lib/staff/authorization";
import { redirect } from "next/navigation";

/** Block soft-deactivated students from /app/* (except via redirect target). */
export async function requireActiveStudentAppAccess() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  const staff = await getCurrentStaffAccess(user);
  if (staff) {
    return user;
  }

  const [deactivatedAt, deletionStatus] = await Promise.all([
    getStudentDeactivatedAt(user.id),
    getMyAccountDeletionStatus(),
  ]);
  if (
    deletionStatus === "pending" ||
    deletionStatus === "processing" ||
    deletionStatus === "failed"
  ) {
    redirect("/account/deletion-pending");
  }
  if (deactivatedAt) {
    redirect("/account/reactivate");
  }

  return user;
}
