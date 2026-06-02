import { prisma } from "@/lib/db";
import { requireCanSubmitReimbursement } from "@/lib/auth-api";
import { claimInclude, serializeClaim } from "@/lib/claims";

export async function GET() {
  const session = await requireCanSubmitReimbursement();
  if (session instanceof Response) return session;

  const claims = await prisma.reimbursement.findMany({
    where: { employeeId: session.id },
    orderBy: { createdAt: "desc" },
    include: claimInclude,
  });

  return Response.json(claims.map(serializeClaim));
}
