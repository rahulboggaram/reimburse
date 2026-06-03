import { requireSession } from "@/lib/auth-api";
import { bulkPayPaymentQueue } from "@/lib/bulk-claim-actions";

export async function POST() {
  const session = await requireSession();
  if (session instanceof Response) return session;

  if (session.role !== "ADMIN" && session.role !== "APPROVER") {
    return Response.json({ error: "You do not have access." }, { status: 403 });
  }

  const result = await bulkPayPaymentQueue(session);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 503 });
  }

  return Response.json(result);
}
