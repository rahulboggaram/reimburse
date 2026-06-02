import { prisma } from "@/lib/db";
import { initiateClaimPayout } from "@/lib/payouts";
import { isPayoutFailed } from "@/lib/razorpayx";

const employeeForPayoutSelect = {
  id: true,
  name: true,
  phone: true,
  ifscCode: true,
  bankAccountNumber: true,
  razorpayContactId: true,
  razorpayFundAccountId: true,
} as const;

export function userCanReceivePayout(user: {
  name: string | null;
  ifscCode: string | null;
  bankAccountNumber: string | null;
}) {
  return Boolean(
    user.name?.trim() &&
      user.ifscCode?.trim() &&
      user.bankAccountNumber?.trim(),
  );
}

/** After an admin submits an approved claim, send payout to their own bank account. */
export async function tryAutoPayAdminClaim(claimId: string, actorId: string) {
  const claim = await prisma.reimbursement.findUnique({
    where: { id: claimId },
    include: { employee: { select: employeeForPayoutSelect } },
  });

  if (!claim || claim.status !== "APPROVED" || claim.employeeId !== actorId) {
    return;
  }

  const submitter = await prisma.user.findUnique({
    where: { id: claim.employeeId },
    select: { role: true },
  });
  if (submitter?.role !== "ADMIN") return;
  if (!userCanReceivePayout(claim.employee)) return;
  if (
    claim.razorpayPayoutId &&
    claim.payoutStatus &&
    !isPayoutFailed(claim.payoutStatus)
  ) {
    return;
  }

  try {
    await initiateClaimPayout({ claim, actorId });
  } catch (err) {
    console.error("admin auto-payout failed", err);
  }
}
