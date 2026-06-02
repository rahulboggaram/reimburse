import { prisma } from "@/lib/db";
import { requireCanSubmitReimbursement } from "@/lib/auth-api";

export async function GET() {
  const session = await requireCanSubmitReimbursement();
  if (session instanceof Response) return session;

  return Response.json([]);
}
