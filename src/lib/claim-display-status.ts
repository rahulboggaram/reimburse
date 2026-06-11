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

/** Admin submits and pays themselves — no payment-approver queue. */
export function isAdminSelfServiceClaim(claim: {
  employeeId: string;
  approverId: string;
  paymentApproverId: string;
}): boolean {
  return (
    claim.employeeId === claim.approverId &&
    claim.employeeId === claim.paymentApproverId
  );
}

/** Payment runs via admin / Razorpay, not a separate payment-approver queue. */
export function isAdminLedPayment(claim: {
  employeeId: string;
  employee?: { role: string };
  approverId: string;
  paymentApproverId: string;
}): boolean {
  if (isAdminSelfServiceClaim(claim)) return true;
  return (
    claim.employee?.role === "APPROVER" &&
    claim.approverId === claim.paymentApproverId
  );
}

/** Payment approver queue — not used when admin already owns payment (e.g. approver submitter). */
function awaitingPaymentApprover(claim: {
  employeeId: string;
  approverId: string;
  paymentApproverId: string;
  status: string;
  paidAt?: string | null;
  razorpayPayoutId?: string | null;
  payoutStatus?: string | null;
}) {
  if (isAdminSelfServiceClaim(claim)) return false;
  if (claim.approverId === claim.paymentApproverId) return false;
  return (
    claim.status === "APPROVED" &&
    !claim.paidAt &&
    (!claim.razorpayPayoutId || payoutFailed(claim.payoutStatus))
  );
}

export function claimDisplayStatus(
  claim: {
    submitting?: boolean;
    submitError?: string | null;
    employeeId?: string;
    approverId?: string;
    paymentApproverId?: string;
    status: string;
    paidAt?: string | null;
    razorpayPayoutId?: string | null;
    payoutStatus?: string | null;
  },
  _viewerRole?: string,
): string {
  if (claim.submitError) {
    return "submitFailed";
  }

  if (claim.submitting) {
    return "submitting";
  }

  if (claim.status === "PAID" || claim.paidAt) {
    return "PAID";
  }

  const routingIds =
    claim.employeeId && claim.approverId && claim.paymentApproverId
      ? {
          employeeId: claim.employeeId,
          approverId: claim.approverId,
          paymentApproverId: claim.paymentApproverId,
        }
      : null;

  if (routingIds && awaitingPaymentApprover({ ...claim, ...routingIds })) {
    return "AWAITING";
  }

  if (claim.status === "PENDING") {
    return "AWAITING";
  }

  if (claim.status === "APPROVED" && claim.razorpayPayoutId) {
    if (payoutFailed(claim.payoutStatus)) {
      return claim.payoutStatus ?? "failed";
    }
    if (claim.payoutStatus === "processed") {
      return "PAID";
    }
    if (payoutInProgress(claim.payoutStatus)) {
      return "paying";
    }
    return "paying";
  }

  if (
    routingIds &&
    isAdminSelfServiceClaim(routingIds) &&
    claim.status === "APPROVED"
  ) {
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
