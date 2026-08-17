export type StaffRole = "owner" | "admin";

export type StaffCapability =
  | "early_access.read"
  | "users.read"
  | "users.support"
  | "moderation.review"
  | "verification.review"
  | "staff.manage";

export type StaffCapabilityFlags = {
  role: StaffRole;
  verificationReviewer: boolean;
  canEarlyAccessRead: boolean;
  canUsersRead: boolean;
  canUsersSupport: boolean;
};

export function staffHasCapability(
  access: StaffCapabilityFlags,
  capability: StaffCapability,
): boolean {
  if (access.role === "owner") {
    return true;
  }

  switch (capability) {
    case "early_access.read":
      return access.canEarlyAccessRead;
    case "users.read":
      return access.canUsersRead || access.canUsersSupport;
    case "users.support":
      return access.canUsersSupport;
    case "verification.review":
      return access.verificationReviewer;
    case "moderation.review":
      return false;
    case "staff.manage":
      return false;
    default: {
      const _exhaustive: never = capability;
      return _exhaustive;
    }
  }
}
