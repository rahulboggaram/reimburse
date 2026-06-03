import { requireSession } from "@/lib/auth-api";
import { bulkAdminApproveQueue } from "@/lib/bulk-claim-actions";

export async function POST() {
  const session = await requireSession();
  if (session instanceof Response) return session;

  if (session.role !== "ADMIN") {
    return Response.json({ error: "Only admins can approve all at once." }, { status: 403 });
  }

  const result = await bulkAdminApproveQueue(session.id);
  return Response.json(result);
}
