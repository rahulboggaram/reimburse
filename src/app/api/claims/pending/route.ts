import { prisma } from "@/lib/db";
import { requireManagerAccess } from "@/lib/auth-api";
import { claimInclude, serializeClaim } from "@/lib/claims";

export async function GET() {
  const session = await requireManagerAccess();
  if (session instanceof Response) return session;

  const where =
    session.role === "BRANCH_MANAGER"
      ? { status: "PENDING" as const, approverId: session.id }
      : session.role === "APPROVER"
        ? {
            status: "APPROVED" as const,
            paymentApproverId: session.id,
            paidAt: null,
          }
        : { status: "PENDING" as const };

  const claims = await prisma.reimbursement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: claimInclude,
  });

  return Response.json(claims.map(serializeClaim));
}
