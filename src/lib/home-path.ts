import type { UserRole } from "@prisma/client";

/** Logo and post-login home — new reimbursement form for every role. */
export function getAppHomePathForRole(_role: UserRole | string): string {
  return "/employee";
}

export function getAppHomePath(
  user: {
    role: string;
    profileComplete?: boolean;
  } | null,
) {
  if (!user) return "/login";
  if (user.profileComplete === false) return "/employee/onboarding";
  return getAppHomePathForRole(user.role);
}
