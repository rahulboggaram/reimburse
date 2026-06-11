import { after } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { canPaymentApproverAccessClaim } from "@/lib/payment-approver";
import { claimInclude, serializeClaim } from "@/lib/claims";
import { payClaimInBackground } from "@/lib/pay-claim-background";
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
          "RazorpayX is not configured on the server. Add API keys or VPS relay settings on Vercel.",
      },
      { status: 503 },
    );
  }

  const claimId = id;
  const actorId = session.id;
  after(async () => {
    await payClaimInBackground(claimId, actorId);
  });

  return Response.json(serializeClaim(claim));
}

