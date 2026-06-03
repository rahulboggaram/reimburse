export function payoutInProgress(status: string | null | undefined) {
  return status === "queued" || status === "pending" || status === "processing";
}

function awaitingFinancePayment(claim: {
  status: string;
  paidAt?: string | null;
  payoutStatus?: string | null;
}) {
  return (
    claim.status === "APPROVED" &&
    !claim.paidAt &&
    !payoutInProgress(claim.payoutStatus)
  );
}

/** Branch managers and employees see finance handoff, not generic “approved”. */
function showsPendingFinanceApproval(viewerRole: string | undefined) {
  return viewerRole === "BRANCH_MANAGER" || viewerRole === "EMPLOYEE";
}

export function claimDisplayStatus(
  claim: {
    status: string;
    paidAt?: string | null;
    payoutStatus?: string | null;
  },
  viewerRole?: string,
): string {
  if (awaitingFinancePayment(claim) && showsPendingFinanceApproval(viewerRole)) {
    return "PENDING_FINANCE_APPROVAL";
  }

  if (claim.status === "APPROVED" && payoutInProgress(claim.payoutStatus)) {
    return "paying";
  }

  return claim.status;
}

export function canInitiateClaimPayment(
  viewerRole: string | undefined,
  variant: "employee" | "admin" | "approver",
): boolean {
  if (variant === "admin") return true;
  if (variant === "approver") return viewerRole === "APPROVER";
  return false;
}
