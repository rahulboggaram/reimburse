import { requireManagerAccess } from "@/lib/auth-api";
import {
  countAdminPendingApproval,
  countPaymentWaiting,
} from "@/lib/bulk-claim-actions";

export async function GET() {
  const session = await requireManagerAccess();
  if (session instanceof Response) return session;

  const [paymentWaiting, adminPending] = await Promise.all([
    session.role === "ADMIN" || session.role === "APPROVER"
      ? countPaymentWaiting(session)
      : Promise.resolve(0),
    session.role === "ADMIN"
      ? countAdminPendingApproval()
      : Promise.resolve(0),
  ]);

  return Response.json(
    { paymentWaiting, adminPending },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
