import { prisma } from "@/lib/db";

/** All roles must pick an active branch on the reimbursement form. */
export async function resolveClaimBranchId(
  branchId: string,
): Promise<{ branchId: string } | { error: string }> {
  const trimmed = branchId.trim();
  if (!trimmed) {
    return { error: "Select a branch." };
  }

  const branch = await prisma.branch.findFirst({
    where: { id: trimmed, active: true },
  });
  if (!branch) return { error: "Invalid branch." };
  return { branchId: branch.id };
}
