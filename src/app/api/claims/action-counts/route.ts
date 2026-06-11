import { requireManagerAccess } from "@/lib/auth-api";
import {
  countAdminPendingApproval,
  countPaymentWaiting,
} from "@/lib/bulk-claim-actions";
import { isTransientDbError, withDbRetry } from "@/lib/db-retry";

export async function GET() {
  try {
    const session = await requireManagerAccess();
    if (session instanceof Response) return session;

    const [paymentWaiting, adminPending] = await withDbRetry(() =>
      Promise.all([
        session.role === "ADMIN" || session.role === "APPROVER"
          ? countPaymentWaiting(session)
          : Promise.resolve(0),
        session.role === "ADMIN"
          ? countAdminPendingApproval()
          : Promise.resolve(0),
      ]),
    );

    return Response.json(
      { paymentWaiting, adminPending },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch (err) {
    console.error("claims/action-counts failed", err);
    if (isTransientDbError(err)) {
      return Response.json(
        { paymentWaiting: 0, adminPending: 0, retry: true },
        {
          status: 503,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }
    return Response.json(
      { error: "Could not load counts." },
      { status: 500 },
    );
  }
}
