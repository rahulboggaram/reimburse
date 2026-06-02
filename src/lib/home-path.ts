export function getAppHomePath(
  user: {
    role: string;
    profileComplete?: boolean;
  } | null,
) {
  if (!user) return "/login";
  if (user.role === "EMPLOYEE" && user.profileComplete === false) {
    return "/employee/onboarding";
  }
  return "/employee";
}
