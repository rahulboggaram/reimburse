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

export async function describeClaimRoutingReadiness(
  submitter: Submitter,
  branchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { name: true },
  });
  const branchLabel = branch?.name ?? "your branch";

  if (submitter.role === "ADMIN") {
    return { ok: true };
  }

  if (submitter.role === "APPROVER") {
    const admin = await findActiveUserForBranch("ADMIN", branchId);
    if (!admin) {
      return {
        ok: false,
        error: `No admin is assigned to ${branchLabel} yet. Ask your admin to fix this in People.`,
      };
    }
    return { ok: true };
  }

  const [branchManager, paymentApprover] = await Promise.all([
    findActiveUserForBranch("BRANCH_MANAGER", branchId),
    findActiveUserForBranch("APPROVER", branchId),
  ]);

  if (!branchManager) {
    return {
      ok: false,
      error: `No branch manager assigned for ${branchLabel} yet. Ask your admin to add one in People.`,
    };
  }
  if (!paymentApprover) {
    return {
      ok: false,
      error: `No payment approver assigned for ${branchLabel} yet. Ask your admin to add a Payment Approver to this branch in People.`,
    };
  }

  return { ok: true };
}

export async function resolveClaimRouting(
  submitter: Submitter,
  branchId: string,
): Promise<{ routing: ClaimRouting } | { error: string }> {
  const readiness = await describeClaimRoutingReadiness(submitter, branchId);
  if (!readiness.ok) {
    return { error: readiness.error };
  }

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
      return { error: "No admin is assigned to this branch yet." };
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

  const branchManager = await findActiveUserForBranch("BRANCH_MANAGER", branchId);
  const paymentApprover = await findActiveUserForBranch("APPROVER", branchId);
  if (!branchManager || !paymentApprover) {
    return { error: "Could not assign approvers for this branch." };
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
