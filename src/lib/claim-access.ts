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
  return ownClaimsOnly(claims, employeeId);
}

/** Keep only reimbursements this user submitted (employeeId = their account). */
export function ownClaimsOnly<T extends { employeeId: string }>(
  claims: T[],
  ownerId: string,
): T[] {
  if (!ownerId) return [];
  return claims.filter((claim) => claim.employeeId === ownerId);
}
