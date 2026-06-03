export type ProfileFields = {
  name: string | null;
  ifscCode: string | null;
  bankAccountNumber: string | null;
};

/** Name + bank details required before using the app (all roles). */
export function isProfileComplete(user: ProfileFields): boolean {
  return Boolean(
    user.name?.trim() &&
      user.ifscCode?.trim() &&
      user.bankAccountNumber?.trim(),
  );
}

/** @deprecated Use {@link isProfileComplete} */
export const isEmployeeProfileComplete = isProfileComplete;

/** e.g. "ananya patel" → "Ananya Patel" */
export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
}

export function userDisplayLabel(user: {
  name: string | null;
  phone: string;
}): string {
  if (user.name?.trim()) return toTitleCase(user.name.trim());
  const digits = user.phone.replace(/\D/g, "");
  if (digits.length >= 10) {
    const local = digits.slice(-10);
    return `${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return user.phone;
}

export function maskAccountNumber(account: string): string {
  const digits = account.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}
