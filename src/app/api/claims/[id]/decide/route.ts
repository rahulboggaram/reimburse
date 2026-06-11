import { after } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerAccess } from "@/lib/auth-api";
import { tryAutoPayAfterAdminApproval } from "@/lib/admin-auto-payout";
import { canDecideReimbursement } from "@/lib/claim-decide-access";
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
    include: {
      employee: { select: { ...employeeForPayoutSelect, role: true } },
      approver: { select: { role: true } },
      branch: { select: { name: true } },
    },
  });
  if (!existing) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }
  if (existing.status !== "PENDING") {
    return Response.json({ error: "Claim already decided" }, { status: 409 });
  }
  if (!canDecideReimbursement(session, existing)) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  await prisma.reimbursement.update({
    where: { id },
    data: {
      status: body.data.status,
      decidedAt: new Date(),
      ...(session.role === "ADMIN" ? { approverId: session.id } : {}),
      rejectionReason:
        body.data.status === "REJECTED"
          ? body.data.rejectionReason ?? null
          : null,
    },
  });

  if (body.data.status === "APPROVED" && session.role === "ADMIN") {
    const claimId = id;
    const adminId = session.id;
    after(async () => {
      const payoutResult = await tryAutoPayAfterAdminApproval(claimId, adminId);
      if (!payoutResult.ok && "error" in payoutResult) {
        console.error("background payout after admin approval failed", {
          claimId,
          error: payoutResult.error,
        });
      }
    });
  }

  const claim = await prisma.reimbursement.findUnique({
    where: { id },
    include: claimInclude,
  });

  return Response.json(serializeClaim(claim!));
}
