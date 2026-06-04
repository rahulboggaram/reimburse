import type { UserRole } from "@prisma/client";
import { roleRequiresBranchAssignment } from "@/lib/claim-branch-roles";

export { roleRequiresBranchAssignment } from "@/lib/claim-branch-roles";

export function userRoleRequiresBranch(role: UserRole | string): boolean {
  return roleRequiresBranchAssignment(role);
}
