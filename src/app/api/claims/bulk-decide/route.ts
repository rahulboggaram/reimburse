import { requireSession } from "@/lib/auth-api";
import { bulkAdminApproveClaimIds } from "@/lib/bulk-claim-actions";
import { bulkClaimIdsSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await requireSession();
  if (session instanceof Response) return session;

  if (session.role !== "ADMIN") {
    return Response.json({ error: "Only admins can approve in bulk." }, { status: 403 });
  }

  const body = bulkClaimIdsSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Select at least one reimbursement to approve." },
      { status: 400 },
    );
  }

  const result = await bulkAdminApproveClaimIds(
    session.id,
    body.data.claimIds,
    session.branchId,
  );
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
