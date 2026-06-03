export function payoutInProgress(status: string | null | undefined) {
  return status === "queued" || status === "pending" || status === "processing";
}

function payoutFailed(status: string | null | undefined) {
  return (
    status === "failed" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "reversed"
  );
}

function awaitingPaymentApprover(claim: {
  status: string;
  paidAt?: string | null;
  razorpayPayoutId?: string | null;
  payoutStatus?: string | null;
}) {
  return (
    claim.status === "APPROVED" &&
    !claim.paidAt &&
    (!claim.razorpayPayoutId || payoutFailed(claim.payoutStatus))
  );
}

export function claimDisplayStatus(
  claim: {
    status: string;
    paidAt?: string | null;
    razorpayPayoutId?: string | null;
    payoutStatus?: string | null;
  },
  _viewerRole?: string,
): string {
  if (claim.status === "PAID" || claim.paidAt) {
    return "PAID";
  }

  if (awaitingPaymentApprover(claim)) {
    return "QUEUED";
  }

  if (claim.status === "APPROVED" && claim.razorpayPayoutId) {
    if (payoutFailed(claim.payoutStatus)) {
      return claim.payoutStatus ?? "failed";
    }
    if (payoutInProgress(claim.payoutStatus)) {
      return "paying";
    }
    if (claim.payoutStatus === "processed") {
      return "PAID";
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
