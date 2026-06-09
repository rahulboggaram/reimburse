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
      RAZORPAYX_KEY_ID: "rzp_live_... (Live keys — Developer Controls → Generate Live Key)",
      RAZORPAYX_KEY_SECRET: "(live secret from the same key pair)",
      RAZORPAYX_ACCOUNT_NUMBER:
        "(Live Customer Identifier — Banking → Customer Identifier)",
      RAZORPAYX_PAYOUT_MODE: "IMPS",
      RAZORPAYX_WEBHOOK_SECRET:
        "(optional — pick any password in Razorpay webhook setup, paste same here)",
    },
    webhookUrl: "https://reimburse-jade.vercel.app/api/webhooks/razorpayx",
  });
}
