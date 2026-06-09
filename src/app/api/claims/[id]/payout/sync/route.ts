import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { canPaymentApproverAccessClaim } from "@/lib/payment-approver";
import { claimInclude, serializeClaim } from "@/lib/claims";
import { syncPayoutForClaim } from "@/lib/payouts";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireSession();
  if (session instanceof Response) return session;

  const existing = await prisma.reimbursement.findUnique({
    where: { id },
    select: {
      id: true,
      employeeId: true,
      razorpayPayoutId: true,
      employee: { select: { role: true } },
    },
  });
  if (!existing) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  const isOwner = existing.employeeId === session.id;
  const isAdmin = session.role === "ADMIN";
  const isPaymentApprover =
    session.role === "APPROVER" &&
    canPaymentApproverAccessClaim(session, existing);

  if (!isOwner && !isAdmin && !isPaymentApprover) {
    return Response.json({ error: "You do not have access." }, { status: 403 });
  }
  if (!existing.razorpayPayoutId) {
    return Response.json(
      { error: "No payout exists for this claim yet." },
      { status: 400 },
    );
  }

  try {
    await syncPayoutForClaim(id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not sync payout.";
    return Response.json({ error: message }, { status: 502 });
  }

  const updated = await prisma.reimbursement.findUnique({
    where: { id },
    include: claimInclude,
  });

  return Response.json(serializeClaim(updated!));
}
