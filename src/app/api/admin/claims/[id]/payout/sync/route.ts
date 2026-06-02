import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { claimInclude, serializeClaim } from "@/lib/claims";
import { syncPayoutForClaim } from "@/lib/payouts";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const existing = await prisma.reimbursement.findUnique({
    where: { id },
    select: { id: true, razorpayPayoutId: true },
  });
  if (!existing) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }
  if (!existing.razorpayPayoutId) {
    return Response.json({ error: "No payout exists for this claim yet." }, { status: 400 });
  }

  try {
    await syncPayoutForClaim(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sync payout.";
    return Response.json({ error: message }, { status: 502 });
  }

  const updated = await prisma.reimbursement.findUnique({
    where: { id },
    include: claimInclude,
  });

  return Response.json(serializeClaim(updated!));
}

