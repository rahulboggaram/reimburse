import type { UserRole } from "@prisma/client";

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
    return { branchManager: null };
  }

  return {
    branchManager:
      people.find(
        (person) =>
          person.active &&
          person.role === "BRANCH_MANAGER" &&
          person.branchId === branchId,
      ) ?? null,
  };
}
