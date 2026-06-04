import type { UserRole } from "@prisma/client";
import { canAccessManagerPortal } from "@/lib/access-roles";

export function getAppHomePathForRole(role: UserRole | string): string {
  const r = role as UserRole;
  if (r === "ADMIN") return "/employee";
  if (canAccessManagerPortal(r)) return "/manager";
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
