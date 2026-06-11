import { after } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { claimInclude, serializeClaim } from "@/lib/claims";
import { payClaimInBackground } from "@/lib/pay-claim-background";
import { getRazorpayConfig } from "@/lib/razorpayx";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const claim = await prisma.reimbursement.findUnique({
    where: { id },
    include: {
      ...claimInclude,
      employee: {
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          ifscCode: true,
          bankAccountNumber: true,
          razorpayContactId: true,
          razorpayFundAccountId: true,
        },
      },
    },
  });

  if (!claim) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  const razorpay = getRazorpayConfig();
  if (!razorpay.enabled) {
    return Response.json(
      {
        error:
          "RazorpayX is not configured. Add API keys or VPS relay settings on Vercel.",
      },
      { status: 503 },
    );
  }

  const claimId = id;
  const actorId = session.id;
  after(async () => {
    await payClaimInBackground(claimId, actorId);
  });

  return Response.json(serializeClaim(claim));
}
