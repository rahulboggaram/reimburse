import type { UserRole } from "@prisma/client";

/** Roles an admin can assign on the People screen. */
export const ASSIGNABLE_ROLES = [
  "EMPLOYEE",
  "BRANCH_MANAGER",
  "APPROVER",
  "ADMIN",
] as const satisfies readonly UserRole[];

export const ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE: "Employee",
  BRANCH_MANAGER: "Branch Manager",
  APPROVER: "Payment Approver",
  ADMIN: "Admin",
};

export function formatRole(role: UserRole | string): string {
  return ROLE_LABELS[role as UserRole] ?? role;
}

export function canAccessAdminPortal(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canAccessManagerPortal(role: UserRole): boolean {
  return (
    role === "ADMIN" || role === "BRANCH_MANAGER" || role === "APPROVER"
  );
}

export function canAccessEmployeePortal(_role: UserRole): boolean {
  return true;
}

/** Who may open My Reimbursements and list their own claims. */
export function canViewOwnReimbursements(user: {
  role: string;
  profileComplete: boolean;
}): boolean {
  if (user.role === "EMPLOYEE") return user.profileComplete;
  return (
    user.role === "BRANCH_MANAGER" ||
    user.role === "APPROVER" ||
    user.role === "ADMIN"
  );
}
