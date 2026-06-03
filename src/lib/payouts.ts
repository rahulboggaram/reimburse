import type { Reimbursement, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logPlatformActivity } from "@/lib/activity-log";
import {
  createReimbursementPayout,
  fetchPayoutById,
  getRazorpayConfig,
  isPayoutFailed,
  isPayoutInProgress,
  isPayoutSuccessful,
  payoutErrorMessage,
  type RazorpayPayoutResponse,
} from "@/lib/razorpayx";

type ClaimForPayout = Reimbursement & {
  employee: Pick<
    User,
    | "id"
    | "name"
    | "phone"
    | "ifscCode"
    | "bankAccountNumber"
    | "razorpayContactId"
    | "razorpayFundAccountId"
  >;
};

export async function initiateClaimPayout(input: {
  claim: ClaimForPayout;
  actorId: string;
}) {
  const { claim, actorId } = input;

  if (claim.status !== "APPROVED") {
    throw new Error("Only approved claims can be paid.");
  }
  if (claim.razorpayPayoutId && claim.payoutStatus && !isPayoutFailed(claim.payoutStatus)) {
    throw new Error("A payout is already in progress for this claim.");
  }

  const employee = claim.employee;
  if (!employee.name?.trim()) {
    throw new Error("Employee name is missing.");
  }
  if (!employee.ifscCode?.trim() || !employee.bankAccountNumber?.trim()) {
    throw new Error("Employee bank details are incomplete.");
  }

  const { payout, contactId, fundAccountId } = await createReimbursementPayout({
    claimId: claim.id,
    amount: Number(claim.amount),
    employeeName: employee.name.trim(),
    employeePhone: employee.phone,
    employeeId: employee.id,
    ifscCode: employee.ifscCode.trim(),
    bankAccountNumber: employee.bankAccountNumber.trim(),
    category: claim.category,
    idempotencyKey: claim.id,
  });

  if (contactId || fundAccountId) {
    await prisma.user.update({
      where: { id: employee.id },
      data: {
        razorpayContactId: contactId ?? undefined,
        razorpayFundAccountId: fundAccountId ?? undefined,
      },
    });
  }

  return applyPayoutResult({
    claimId: claim.id,
    employeeId: employee.id,
    employeeName: claim.employeeName,
    amount: Number(claim.amount),
    actorId,
    payout,
    previousPayoutStatus: claim.payoutStatus,
  });
}

export async function applyPayoutResult(input: {
  claimId: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  actorId?: string;
  payout: RazorpayPayoutResponse;
  previousPayoutStatus?: string | null;
}) {
  const { payout } = input;
  const status = payout.status;
  const now = new Date();
  const errorMessage = isPayoutFailed(status) ? payoutErrorMessage(payout) : null;
  const previous = input.previousPayoutStatus ?? null;

  const claim = await prisma.reimbursement.update({
    where: { id: input.claimId },
    data: {
      razorpayPayoutId: payout.id,
      payoutStatus: status,
      payoutUtr: payout.utr ?? null,
      payoutError: errorMessage,
      payoutInitiatedAt: now,
      paidAt: isPayoutSuccessful(status) ? now : null,
      status: isPayoutSuccessful(status) ? "PAID" : "APPROVED",
    },
  });

  if (isPayoutSuccessful(status) && previous !== "processed") {
    await logPlatformActivity({
      type: "PAYOUT_COMPLETED",
      actorId: input.actorId,
      targetUserId: input.employeeId,
      summary: `Paid ₹${input.amount.toLocaleString("en-IN")} to ${input.employeeName} via RazorpayX`,
      metadata: {
        claimId: input.claimId,
        payoutId: payout.id,
        utr: payout.utr,
      },
    });
  } else if (isPayoutFailed(status) && !isPayoutFailed(previous ?? "")) {
    await logPlatformActivity({
      type: "PAYOUT_FAILED",
      actorId: input.actorId,
      targetUserId: input.employeeId,
      summary: `Payout failed for ${input.employeeName} (₹${input.amount.toLocaleString("en-IN")})`,
      metadata: {
        claimId: input.claimId,
        payoutId: payout.id,
        error: errorMessage,
      },
    });
  } else if (
    isPayoutInProgress(status) &&
    !previous &&
    input.actorId
  ) {
    await logPlatformActivity({
      type: "PAYOUT_INITIATED",
      actorId: input.actorId,
      targetUserId: input.employeeId,
      summary: `Payout initiated for ${input.employeeName} (₹${input.amount.toLocaleString("en-IN")})`,
      metadata: {
        claimId: input.claimId,
        payoutId: payout.id,
        status,
      },
    });
  }

  return claim;
}

/** Refresh payout status from Razorpay when still queued or processing. */
export async function refreshPayoutIfInProgress(claimId: string) {
  const claim = await prisma.reimbursement.findUnique({
    where: { id: claimId },
    select: { razorpayPayoutId: true, payoutStatus: true },
  });
  if (!claim?.razorpayPayoutId) return null;
  if (!claim.payoutStatus || !isPayoutInProgress(claim.payoutStatus)) {
    return null;
  }
  return syncPayoutForClaim(claimId);
}

export async function syncPayoutFromWebhook(payout: RazorpayPayoutResponse) {
  const claim = await prisma.reimbursement.findFirst({
    where: { razorpayPayoutId: payout.id },
    include: {
      employee: {
        select: { id: true, name: true },
      },
    },
  });

  if (!claim) {
    return null;
  }

  return applyPayoutResult({
    claimId: claim.id,
    employeeId: claim.employeeId,
    employeeName: claim.employeeName,
    amount: Number(claim.amount),
    payout,
    previousPayoutStatus: claim.payoutStatus,
  });
}

export async function syncPayoutForClaim(claimId: string) {
  const claim = await prisma.reimbursement.findUnique({
    where: { id: claimId },
    include: {
      employee: { select: { id: true, name: true } },
    },
  });
  if (!claim?.razorpayPayoutId) return null;

  const payout = await fetchPayoutById(claim.razorpayPayoutId);
  return applyPayoutResult({
    claimId: claim.id,
    employeeId: claim.employeeId,
    employeeName: claim.employeeName,
    amount: Number(claim.amount),
    payout,
    previousPayoutStatus: claim.payoutStatus,
  });
}

export async function razorpayStatusForAdmin() {
  const config = getRazorpayConfig();
  const keyEnvironment = config.keyId.startsWith("rzp_live_")
    ? ("live" as const)
    : config.keyId.startsWith("rzp_test_")
      ? ("test" as const)
      : ("unknown" as const);

  const missingEnv: string[] = [];
  if (!config.mock) {
    if (!config.keyId) missingEnv.push("RAZORPAYX_KEY_ID");
    if (!config.keySecret) missingEnv.push("RAZORPAYX_KEY_SECRET");
    if (!config.accountNumber) missingEnv.push("RAZORPAYX_ACCOUNT_NUMBER");
  }

  const recentPayouts = await prisma.reimbursement.findMany({
    where: { razorpayPayoutId: { not: null } },
    orderBy: { payoutInitiatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      employeeName: true,
      amount: true,
      razorpayPayoutId: true,
      payoutStatus: true,
      payoutError: true,
      payoutInitiatedAt: true,
    },
  });

  const approvedAwaitingPay = await prisma.reimbursement.count({
    where: {
      status: "APPROVED",
      OR: [{ razorpayPayoutId: null }, { payoutStatus: { in: ["failed", "rejected", "cancelled", "reversed"] } }],
    },
  });

  return {
    configured: config.enabled,
    mock: config.mock,
    mode: config.payoutMode,
    keyEnvironment,
    missingEnv,
    approvedAwaitingPay,
    recentPayouts: recentPayouts.map((row) => ({
      claimId: row.id,
      employeeName: row.employeeName,
      amount: Number(row.amount),
      payoutId: row.razorpayPayoutId,
      payoutStatus: row.payoutStatus,
      payoutError: row.payoutError,
      initiatedAt: row.payoutInitiatedAt?.toISOString() ?? null,
      isSimulated: row.razorpayPayoutId?.startsWith("pout_mock_") ?? false,
    })),
  };
}
