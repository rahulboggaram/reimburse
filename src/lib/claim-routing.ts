import type { ReimbursementStatus, User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ClaimRouting = {
  approverId: string;
  paymentApproverId: string;
  status: ReimbursementStatus;
  decidedAt: Date | null;
};

type Submitter = Pick<User, "id" | "role">;

async function findActiveUserForBranch(
  role: UserRole,
  branchId: string,
  excludeId?: string,
) {
  return prisma.user.findFirst({
    where: {
      role,
      active: true,
      branchId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function resolveClaimRouting(
  submitter: Submitter,
  branchId: string,
): Promise<{ routing: ClaimRouting } | { error: string }> {
  if (submitter.role === "ADMIN") {
    return {
      routing: {
        approverId: submitter.id,
        paymentApproverId: submitter.id,
        status: "APPROVED",
        decidedAt: new Date(),
      },
    };
  }

  if (submitter.role === "APPROVER") {
    const admin = await findActiveUserForBranch("ADMIN", branchId);
    if (!admin) {
      return {
        error: "No admin is assigned to this branch yet.",
      };
    }

    const paymentApprover = await findActiveUserForBranch(
      "APPROVER",
      branchId,
      submitter.id,
    );

    return {
      routing: {
        approverId: admin.id,
        paymentApproverId: paymentApprover?.id ?? admin.id,
        status: "PENDING",
        decidedAt: null,
      },
    };
  }

  const [branchManager, paymentApprover] = await Promise.all([
    findActiveUserForBranch("BRANCH_MANAGER", branchId),
    findActiveUserForBranch("APPROVER", branchId),
  ]);

  if (!branchManager) {
    return { error: "No branch manager assigned for this branch yet." };
  }
  if (!paymentApprover) {
    return {
      error: "No payment approver assigned for this branch yet.",
    };
  }

  return {
    routing: {
      approverId: branchManager.id,
      paymentApproverId: paymentApprover.id,
      status: "PENDING",
      decidedAt: null,
    },
  };
}
