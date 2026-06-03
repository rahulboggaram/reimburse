import type { Prisma } from "@prisma/client";

/** Only reimbursements submitted by this user (defense in depth for list APIs). */
export function claimsForEmployeeWhere(
  employeeId: string,
): Prisma.ReimbursementWhereInput {
  return { employeeId };
}

export function assertClaimsBelongToEmployee<T extends { employeeId: string }>(
  claims: T[],
  employeeId: string,
): T[] {
  return claims.filter((claim) => claim.employeeId === employeeId);
}
