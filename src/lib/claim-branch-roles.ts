const OPTIONAL_BRANCH_ROLES = new Set(["ADMIN", "APPROVER"]);

export function isBranchOptionalForRole(role: string): boolean {
  return OPTIONAL_BRANCH_ROLES.has(role);
}
