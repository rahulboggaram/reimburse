import type { Prisma } from "@prisma/client";
import {
  HEAD_OFFICE_BRANCH_NAME,
  isHeadOfficeBranchName,
} from "@/lib/payment-approver";

type DecideSession = { id: string; role: string };

type DecideClaim = {
  status: string;
  approverId: string;
  employee?: { role: string } | null;
  approver?: { role: string } | null;
  branch?: { name: string } | null;
};

/** Pending reimbursements admin must approve org-wide. */
export function adminApprovalQueueWhere(): Prisma.ReimbursementWhereInput {
  return {
    status: "PENDING",
    approver: { role: "ADMIN" },
    OR: [
      { employee: { role: "APPROVER" } },
      { branch: { name: HEAD_OFFICE_BRANCH_NAME } },
    ],
  };
}

export function isAdminApprovalQueueClaim(claim: DecideClaim): boolean {
  if (claim.status !== "PENDING" || claim.approver?.role !== "ADMIN") {
    return false;
  }
  if (claim.employee?.role === "APPROVER") return true;
  return isHeadOfficeBranchName(claim.branch?.name);
}

export function canDecideReimbursement(
  session: DecideSession,
  claim: DecideClaim,
): boolean {
  if (claim.status !== "PENDING") return false;
  if (session.id === claim.approverId) return true;
  if (session.role === "ADMIN" && isAdminApprovalQueueClaim(claim)) {
    return true;
  }
  return false;
}
