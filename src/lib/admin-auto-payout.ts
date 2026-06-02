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

export type AdminAutoPayoutResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; skipped: true };

/** After an admin submits an approved claim, send payout to their own bank account. */
export async function tryAutoPayAdminClaim(
  claimId: string,
  actorId: string,
): Promise<AdminAutoPayoutResult> {
  const claim = await prisma.reimbursement.findUnique({
    where: { id: claimId },
    include: { employee: { select: employeeForPayoutSelect } },
  });

  if (!claim || claim.status !== "APPROVED" || claim.employeeId !== actorId) {
    return { ok: false, skipped: true };
  }

  const submitter = await prisma.user.findUnique({
    where: { id: claim.employeeId },
    select: { role: true },
  });
  if (submitter?.role !== "ADMIN") return { ok: false, skipped: true };
  if (!userCanReceivePayout(claim.employee)) {
    return {
      ok: false,
      error:
        "Add your name and bank details under Profile before payouts can run.",
    };
  }
  if (
    claim.razorpayPayoutId &&
    claim.payoutStatus &&
    !isPayoutFailed(claim.payoutStatus)
  ) {
    return { ok: false, skipped: true };
  }

  try {
    await initiateClaimPayout({ claim, actorId });
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not send payout to RazorpayX.";
    console.error("admin auto-payout failed", err);
    return { ok: false, error: message };
  }
}
