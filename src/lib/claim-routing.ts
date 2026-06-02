import type { ReimbursementStatus, User } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ClaimRouting = {
  approverId: string;
  paymentApproverId: string;
  status: ReimbursementStatus;
  decidedAt: Date | null;
};

type Submitter = Pick<User, "id" | "role">;

export async function resolveClaimRouting(
  submitter: Submitter,
  branchId: string,
): Promise<{ routing: ClaimRouting } | { error: string }> {
  if (submitter.role === "ADMIN") {
    // Admin claims are self-approved and paid out directly — never routed to payment approver.
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
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN", active: true },
      orderBy: { createdAt: "asc" },
    });
    if (!admin) {
      return { error: "No admin available to approve this claim." };
    }

    const paymentApprover = await prisma.user.findFirst({
      where: {
        role: "APPROVER",
        active: true,
        id: { not: submitter.id },
      },
      orderBy: { createdAt: "asc" },
    });

    const fallbackApprover = await prisma.user.findFirst({
      where: { role: "APPROVER", active: true },
      orderBy: { createdAt: "asc" },
    });

    return {
      routing: {
        approverId: admin.id,
        paymentApproverId:
          paymentApprover?.id ?? fallbackApprover?.id ?? admin.id,
        status: "PENDING",
        decidedAt: null,
      },
    };
  }

  const branchManager = await prisma.user.findFirst({
    where: { role: "BRANCH_MANAGER", active: true, branchId },
    orderBy: { createdAt: "asc" },
  });
  if (!branchManager) {
    return { error: "No branch manager assigned for this branch yet." };
  }

  const paymentApprover = await prisma.user.findFirst({
    where: { role: "APPROVER", active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!paymentApprover) {
    return { error: "No payment approver assigned yet." };
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
