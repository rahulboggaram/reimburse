import { requireSession } from "@/lib/auth-api";
import { bulkPayClaimIds } from "@/lib/bulk-claim-actions";
import { bulkClaimIdsSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await requireSession();
  if (session instanceof Response) return session;

  if (session.role !== "ADMIN" && session.role !== "APPROVER") {
    return Response.json({ error: "You do not have access." }, { status: 403 });
  }

  const body = bulkClaimIdsSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Select at least one reimbursement to pay." },
      { status: 400 },
    );
  }

  const result = await bulkPayClaimIds(session, body.data.claimIds);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 503 });
  }

  return Response.json(result);
}
