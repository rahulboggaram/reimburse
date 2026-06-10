import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { claimInclude, serializeClaim } from "@/lib/claims";
import { initiateClaimPayout, refreshPayoutIfInProgress } from "@/lib/payouts";
import { getRazorpayConfig } from "@/lib/razorpayx";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const claim = await prisma.reimbursement.findUnique({
    where: { id },
    include: {
      ...claimInclude,
      employee: {
        select: {
          id: true,
          name: true,
          phone: true,
          ifscCode: true,
          bankAccountNumber: true,
          razorpayContactId: true,
          razorpayFundAccountId: true,
        },
      },
    },
  });

  if (!claim) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  const razorpay = getRazorpayConfig();
  if (!razorpay.enabled) {
    return Response.json(
      {
        error:
          "RazorpayX is not configured. Add API keys or VPS relay settings on Vercel.",
      },
      { status: 503 },
    );
  }

  try {
    await initiateClaimPayout({ claim, actorId: session.id });
    await refreshPayoutIfInProgress(id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not initiate payout.";
    return Response.json({ error: message }, { status: 400 });
  }

  const updated = await prisma.reimbursement.findUnique({
    where: { id },
    include: claimInclude,
  });

  return Response.json(serializeClaim(updated!));
}
