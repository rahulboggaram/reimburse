import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isBranchOptionalForRole } from "@/lib/claim-branch-roles";

export { isBranchOptionalForRole } from "@/lib/claim-branch-roles";

function roleUsesOptionalBranch(role: UserRole): boolean {
  return isBranchOptionalForRole(role);
}

/** Employees and branch managers must pick a branch; admin/approver may omit (routing uses admin). */
export async function resolveClaimBranchId(
  role: UserRole,
  branchId: string,
): Promise<{ branchId: string } | { error: string }> {
  const trimmed = branchId.trim();

  if (trimmed) {
    const branch = await prisma.branch.findFirst({
      where: { id: trimmed, active: true },
    });
    if (!branch) return { error: "Invalid branch." };
    return { branchId: branch.id };
  }

  if (roleUsesOptionalBranch(role)) {
    const fallback = await prisma.branch.findFirst({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
    if (!fallback) {
      return { error: "No branches configured yet. Ask your admin." };
    }
    return { branchId: fallback.id };
  }

  return { error: "Select a branch." };
}
