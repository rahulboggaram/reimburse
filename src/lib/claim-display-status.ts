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

export function claimDisplayStatus(
  claim: {
    status: string;
    paidAt?: string | null;
    payoutStatus?: string | null;
  },
  _viewerRole?: string,
): string {
  if (awaitingFinancePayment(claim)) {
    return "QUEUED";
  }

  if (claim.status === "PAID" || claim.paidAt) {
    return "PAID";
  }

  if (claim.status === "APPROVED" && payoutInProgress(claim.payoutStatus)) {
    if (claim.payoutStatus === "queued") {
      return "QUEUED";
    }
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
