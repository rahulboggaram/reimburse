import { requireAdminAccess } from "@/lib/auth-api";
import { getRazorpaySetupStatus } from "@/lib/razorpayx";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const status = await getRazorpaySetupStatus();

  return Response.json({
    ...status,
    vercelVars: {
      RAZORPAYX_MOCK: "false",
      RAZORPAYX_KEY_ID: "(rzp_test_... or rzp_live_... from Razorpay dashboard)",
      RAZORPAYX_KEY_SECRET: "(secret from same key pair)",
      RAZORPAYX_ACCOUNT_NUMBER: "(Customer Identifier — Banking in RazorpayX)",
      RAZORPAYX_PAYOUT_MODE: "IMPS",
      RAZORPAYX_WEBHOOK_SECRET: "(from Razorpay webhook settings)",
    },
    webhookUrl: "https://reimburse-jade.vercel.app/api/webhooks/razorpayx",
  });
}
