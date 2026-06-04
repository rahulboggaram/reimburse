import { prisma } from "@/lib/db";
import { roleRequiresBranchAssignment } from "@/lib/claim-branch-roles";

/** Uses the submitter's branch from People — not chosen on the form. */
export async function resolveClaimBranchForUser(
  userId: string,
): Promise<{ branchId: string } | { error: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      branchId: true,
      branch: { select: { id: true, active: true } },
    },
  });

  if (!user) {
    return { error: "Account not found." };
  }

  if (!roleRequiresBranchAssignment(user.role)) {
    return { error: "Your role cannot submit reimbursements." };
  }

  if (!user.branchId || !user.branch) {
    return {
      error:
        "No branch is assigned to your account. Ask your admin to set one in People.",
    };
  }

  if (!user.branch.active) {
    return {
      error: "Your assigned branch is inactive. Ask your admin to update People.",
    };
  }

  return { branchId: user.branch.id };
}
