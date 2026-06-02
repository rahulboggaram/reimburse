export type ProfileFields = {
  name: string | null;
  ifscCode: string | null;
  bankAccountNumber: string | null;
};

export function isEmployeeProfileComplete(user: ProfileFields): boolean {
  return Boolean(
    user.name?.trim() &&
      user.ifscCode?.trim() &&
      user.bankAccountNumber?.trim(),
  );
}

/** e.g. "ananya patel" → "Ananya Patel" */
export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
}

export function maskAccountNumber(account: string): string {
  const digits = account.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}
