import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export type BranchStaffMember = {
  id?: string;
  name?: string | null;
  role: UserRole | string;
  branchId: string | null;
  active: boolean;
};

export function findBranchStaff(
  people: BranchStaffMember[],
  branchId: string | null | undefined,
) {
  if (!branchId) {
    return { branchManager: null, paymentApprover: null };
  }

  return {
    branchManager:
      people.find(
        (person) =>
          person.active &&
          person.role === "BRANCH_MANAGER" &&
          person.branchId === branchId,
      ) ?? null,
    paymentApprover:
      people.find(
        (person) =>
          person.active &&
          person.role === "APPROVER" &&
          person.branchId === branchId,
      ) ?? null,
  };
}

export function listHasPaymentApproverForBranch(
  people: BranchStaffMember[],
  branchId: string,
) {
  return people.some(
    (person) =>
      person.active &&
      person.role === "APPROVER" &&
      person.branchId === branchId,
  );
}

export async function branchHasPaymentApprover(branchId: string) {
  const approver = await prisma.user.findFirst({
    where: { role: "APPROVER", active: true, branchId },
    select: { id: true },
  });
  return Boolean(approver);
}
