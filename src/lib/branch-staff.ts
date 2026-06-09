import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

type BranchStaffMember = {
  role: UserRole | string;
  branchId: string | null;
  active: boolean;
};

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
