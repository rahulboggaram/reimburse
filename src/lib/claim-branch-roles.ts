/** Roles that must have a branch assigned in People and on each reimbursement. */
const BRANCH_ASSIGNED_ROLES = new Set([
  "EMPLOYEE",
  "BRANCH_MANAGER",
  "ADMIN",
  "APPROVER",
]);

export function roleRequiresBranchAssignment(role: string): boolean {
  return BRANCH_ASSIGNED_ROLES.has(role);
}
