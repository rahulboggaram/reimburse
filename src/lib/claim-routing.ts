import type { ReimbursementStatus, User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  findGlobalAdmin,
  findHeadOfficePaymentApprover,
  hasHeadOfficePaymentApprover,
  isHeadOfficeBranchId,
} from "@/lib/payment-approver";

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

async function resolveAdminThenPaymentRouting(
  submitterId: string,
): Promise<{ routing: ClaimRouting } | { error: string }> {
  const admin = await findGlobalAdmin();
  if (!admin) {
    return { error: "No admin is set up yet." };
  }

  const paymentApprover =
    (await findHeadOfficePaymentApprover(submitterId)) ?? admin;

  return {
    routing: {
      approverId: admin.id,
      paymentApproverId: paymentApprover.id,
      status: "PENDING",
      decidedAt: null,
    },
  };
}

async function describeHeadOfficeRoutingReadiness(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const admin = await findGlobalAdmin();
  if (!admin) {
    return {
      ok: false,
      error: "No admin is set up yet. Ask your admin to fix this in People.",
    };
  }

  const hasPaymentApprover = await hasHeadOfficePaymentApprover();
  if (!hasPaymentApprover) {
    return {
      ok: false,
      error:
        "No payment approver is set up at Head Office yet. Ask your admin to add a Payment Approver in People.",
    };
  }

  return { ok: true };
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

  if (submitter.role === "APPROVER" || (await isHeadOfficeBranchId(branchId))) {
    return describeHeadOfficeRoutingReadiness();
  }

  const branchManager = await findActiveUserForBranch("BRANCH_MANAGER", branchId);
  if (!branchManager) {
    return {
      ok: false,
      error: `No branch manager assigned for ${branchLabel} yet. Ask your admin to add one in People.`,
    };
  }

  const hasPaymentApprover = await hasHeadOfficePaymentApprover();
  if (!hasPaymentApprover) {
    return {
      ok: false,
      error:
        "No payment approver is set up at Head Office yet. Ask your admin to add a Payment Approver in People.",
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

  if (submitter.role === "APPROVER" || (await isHeadOfficeBranchId(branchId))) {
    return resolveAdminThenPaymentRouting(submitter.id);
  }

  const branchManager = await findActiveUserForBranch("BRANCH_MANAGER", branchId);
  const paymentApprover = await findHeadOfficePaymentApprover();
  if (!branchManager || !paymentApprover) {
    return { error: "Could not assign approvers for this claim." };
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
