import { prisma } from "@/lib/db";
import { initiateClaimPayout, refreshPayoutIfInProgress } from "@/lib/payouts";

const employeeForPayoutSelect = {
  id: true,
  name: true,
  phone: true,
  role: true,
  ifscCode: true,
  bankAccountNumber: true,
  razorpayContactId: true,
  razorpayFundAccountId: true,
} as const;

export async function payClaimInBackground(claimId: string, actorId: string) {
  const claim = await prisma.reimbursement.findUnique({
    where: { id: claimId },
    include: { employee: { select: employeeForPayoutSelect } },
  });

  if (!claim || claim.status !== "APPROVED") return;

  try {
    await initiateClaimPayout({ claim, actorId });
    await refreshPayoutIfInProgress(claimId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment failed.";
    console.error("background claim payout failed", { claimId, error: message });
    await prisma.reimbursement
      .update({
        where: { id: claimId },
        data: { payoutError: message },
      })
      .catch((updateErr) => {
        console.error("could not save payout error on claim", {
          claimId,
          updateErr,
        });
      });
  }
}
