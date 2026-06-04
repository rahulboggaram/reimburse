import type { Prisma } from "@prisma/client";

type DecideSession = { id: string; role: string };

type DecideClaim = {
  status: string;
  approverId: string;
  employee?: { role: string } | null;
  approver?: { role: string } | null;
};

/** Pending reimbursements that need an admin (e.g. payment approver submissions). */
export function adminApprovalQueueWhere(
  branchId?: string | null,
): Prisma.ReimbursementWhereInput {
  return {
    status: "PENDING",
    approver: { role: "ADMIN" },
    ...(branchId ? { branchId } : {}),
  };
}

export function isAdminApprovalQueueClaim(claim: DecideClaim): boolean {
  return (
    claim.status === "PENDING" &&
    claim.employee?.role === "APPROVER" &&
    claim.approver?.role === "ADMIN"
  );
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
