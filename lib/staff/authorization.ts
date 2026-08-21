import "server-only";

import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  staffHasCapability,
  type StaffCapability,
  type StaffRole,
} from "@/lib/staff/capabilities";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export type { StaffCapability, StaffRole } from "@/lib/staff/capabilities";
export { staffHasCapability } from "@/lib/staff/capabilities";

export type StaffAccess = {
  user: User;
  role: StaffRole;
  verificationReviewer: boolean;
  canEarlyAccessRead: boolean;
  canUsersRead: boolean;
  canUsersSupport: boolean;
};

type MembershipRow = {
  role: StaffRole;
  status: "active";
  verification_reviewer: boolean;
  can_early_access_read?: boolean;
  can_users_read?: boolean;
  can_users_support?: boolean;
};

export async function getCurrentStaffAccess(
  existingUser?: User | null,
): Promise<StaffAccess | null> {
  const user = existingUser === undefined ? await getAuthenticatedUser() : existingUser;
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_current_staff_membership");
  const membership = ((data ?? [])[0] as MembershipRow | undefined) ?? null;
  if (error || !membership || membership.status !== "active") return null;

  const claimRole = user.app_metadata?.role;
  const claimReviewer = user.app_metadata?.verification_reviewer === true;
  if (
    claimRole !== membership.role ||
    claimReviewer !== membership.verification_reviewer
  ) {
    return null;
  }

  return {
    user,
    role: membership.role,
    verificationReviewer: membership.verification_reviewer,
    canEarlyAccessRead: membership.can_early_access_read === true,
    canUsersRead: membership.can_users_read === true,
    canUsersSupport: membership.can_users_support === true,
  };
}

async function redirectNonStaff(user: User | null): Promise<never> {
  if (!user) redirect("/staff/login");
  redirect("/app");
}

export async function requireOwner(): Promise<StaffAccess> {
  const user = await getAuthenticatedUser();
  const access = await getCurrentStaffAccess(user);
  if (!access || access.role !== "owner") return redirectNonStaff(user);
  return access;
}

/** Active owner or admin (campus catalog, shared staff tools). */
export async function requireActiveStaff(): Promise<StaffAccess> {
  const user = await getAuthenticatedUser();
  const access = await getCurrentStaffAccess(user);
  if (!access) return redirectNonStaff(user);
  return access;
}

export async function requireVerificationReviewer(): Promise<StaffAccess> {
  const user = await getAuthenticatedUser();
  const access = await getCurrentStaffAccess(user);
  if (!access || !access.verificationReviewer) return redirectNonStaff(user);
  return access;
}

export async function requireStaffCapability(
  capability: StaffCapability,
): Promise<StaffAccess> {
  const user = await getAuthenticatedUser();
  const access = await getCurrentStaffAccess(user);
  if (!access || !staffHasCapability(access, capability)) {
    return redirectNonStaff(user);
  }
  return access;
}

export async function getPostAuthenticationDestination(user: User) {
  const access = await getCurrentStaffAccess(user);
  if (access?.role === "owner") return "/owner";
  if (access?.role === "admin") return "/admin";
  return "/app";
}
