import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export const HEAD_OFFICE_BRANCH_NAME = "Head Office";

export function isHeadOfficeBranchName(name: string | null | undefined): boolean {
  return name === HEAD_OFFICE_BRANCH_NAME;
}

export async function isHeadOfficeBranchId(branchId: string): Promise<boolean> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId },
    select: { name: true },
  });
  return isHeadOfficeBranchName(branch?.name);
}

type PersonWithRole = {
  id?: string;
  role: UserRole | string;
  active: boolean;
};

export async function findHeadOfficePaymentApprover(excludeId?: string) {
  const headOffice = await prisma.branch.findFirst({
    where: { name: HEAD_OFFICE_BRANCH_NAME, active: true },
    select: { id: true },
  });

  if (headOffice) {
    const onHeadOffice = await prisma.user.findFirst({
      where: {
        role: "APPROVER",
        active: true,
        branchId: headOffice.id,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    if (onHeadOffice) return onHeadOffice;
  }

  return prisma.user.findFirst({
    where: {
      role: "APPROVER",
      active: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function hasHeadOfficePaymentApprover(excludeId?: string) {
  const approver = await findHeadOfficePaymentApprover(excludeId);
  return Boolean(approver);
}

export async function findGlobalAdmin() {
  return prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    orderBy: { createdAt: "asc" },
  });
}

export function listHeadOfficePaymentApprovers(
  people: (PersonWithRole & { name?: string | null; branchName?: string | null })[],
) {
  return people.filter((person) => person.active && person.role === "APPROVER");
}

export function listHasHeadOfficePaymentApprover(
  people: PersonWithRole[],
) {
  return people.some((person) => person.active && person.role === "APPROVER");
}

/** Approved claims any head-office payment approver may pay (not own, not admin). */
export function paymentApproverClaimFilter(
  sessionId: string,
): Prisma.ReimbursementWhereInput {
  return {
    employeeId: { not: sessionId },
    employee: { role: { not: "ADMIN" } },
  };
}

export function canPaymentApproverAccessClaim(
  session: { id: string; role: string },
  claim: { employeeId: string; employee?: { role: string } | null },
): boolean {
  if (session.role !== "APPROVER") return false;
  if (claim.employeeId === session.id) return false;
  if (claim.employee?.role === "ADMIN") return false;
  return true;
}
