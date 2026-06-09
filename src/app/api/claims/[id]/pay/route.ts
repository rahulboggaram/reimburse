import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { canPaymentApproverAccessClaim } from "@/lib/payment-approver";
import { claimInclude, serializeClaim } from "@/lib/claims";
import { initiateClaimPayout, refreshPayoutIfInProgress } from "@/lib/payouts";
import { getRazorpayConfig } from "@/lib/razorpayx";

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

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireSession();
  if (session instanceof Response) return session;

  if (session.role !== "ADMIN" && session.role !== "APPROVER") {
    return Response.json({ error: "You do not have access." }, { status: 403 });
  }

  const claim = await prisma.reimbursement.findUnique({
    where: { id },
    include: {
      ...claimInclude,
      employee: { select: employeeForPayoutSelect },
    },
  });

  if (!claim) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }
  if (claim.status !== "APPROVED") {
    return Response.json(
      { error: "Only approved claims can be paid." },
      { status: 409 },
    );
  }
  if (
    session.role === "APPROVER" &&
    !canPaymentApproverAccessClaim(session, claim)
  ) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  const employee = claim.employee;
  if (!employee.name?.trim()) {
    return Response.json(
      {
        error:
          "Employee name is missing. They must complete their profile before payment.",
      },
      { status: 400 },
    );
  }
  if (!employee.ifscCode?.trim() || !employee.bankAccountNumber?.trim()) {
    return Response.json(
      {
        error:
          "Employee bank details are incomplete. They must add bank details before you can approve payment.",
      },
      { status: 400 },
    );
  }

  const razorpay = getRazorpayConfig();
  if (!razorpay.enabled) {
    return Response.json(
      {
        error:
          "RazorpayX is not configured on the server. Set RAZORPAYX_MOCK=true for demo payouts, or add test/live API keys on Vercel.",
      },
      { status: 503 },
    );
  }

  try {
    await initiateClaimPayout({ claim, actorId: session.id });
    await refreshPayoutIfInProgress(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment failed.";
    return Response.json({ error: message }, { status: 502 });
  }

  const updated = await prisma.reimbursement.findUnique({
    where: { id },
    include: claimInclude,
  });

  return Response.json(serializeClaim(updated!));
}

