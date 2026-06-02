import { prisma } from "@/lib/db";
import { requireManagerAccess } from "@/lib/auth-api";
import { claimInclude, serializeClaim } from "@/lib/claims";
import { decideReimbursementSchema } from "@/lib/validators";

const employeeForPayoutSelect = {
  id: true,
  name: true,
  phone: true,
  ifscCode: true,
  bankAccountNumber: true,
  razorpayContactId: true,
  razorpayFundAccountId: true,
} as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireManagerAccess();
  if (session instanceof Response) return session;

  const body = decideReimbursementSchema.safeParse(await request.json());
  if (!body.success) {
    return Response.json({ error: "Invalid decision" }, { status: 400 });
  }

  const existing = await prisma.reimbursement.findUnique({
    where: { id },
    include: { employee: { select: employeeForPayoutSelect } },
  });
  if (!existing) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }
  if (existing.status !== "PENDING") {
    return Response.json({ error: "Claim already decided" }, { status: 409 });
  }
  if (existing.approverId !== session.id) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  if (body.data.status === "APPROVED") {
    // Branch manager approval should not initiate payment.
    // Payment approver will trigger RazorpayX payout later.
  }

  await prisma.reimbursement.update({
    where: { id },
    data: {
      status: body.data.status,
      decidedAt: new Date(),
      rejectionReason:
        body.data.status === "REJECTED"
          ? body.data.rejectionReason ?? null
          : null,
    },
  });

  const claim = await prisma.reimbursement.findUnique({
    where: { id },
    include: claimInclude,
  });

  return Response.json(serializeClaim(claim!));
}
