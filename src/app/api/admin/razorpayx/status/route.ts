import { requireAdminAccess } from "@/lib/auth-api";
import { razorpayStatusForAdmin } from "@/lib/payouts";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  return Response.json(razorpayStatusForAdmin());
}
