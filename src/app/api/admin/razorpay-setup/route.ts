import { requireAdminAccess } from "@/lib/auth-api";
import { getRazorpaySetupStatus } from "@/lib/razorpayx";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const status = await getRazorpaySetupStatus();
  const useRelay = status.config.relay.enabled;

  return Response.json({
    ...status,
    vercelVars: useRelay
      ? {
          RAZORPAYX_RELAY_URL:
            status.config.relay.url || "http://YOUR_VPS_IP:8787",
          RAZORPAYX_RELAY_SECRET: "(same long random string as on the VPS)",
          RAZORPAYX_ACCOUNT_NUMBER:
            "(Current Account no. — same as on VPS, e.g. 10281413547)",
          RAZORPAYX_PAYOUT_MODE: "IMPS",
          RAZORPAYX_WEBHOOK_SECRET:
            "(optional — pick any password in Razorpay webhook setup, paste same here)",
        }
      : {
          RAZORPAYX_KEY_ID:
            "rzp_live_... (Live keys — Developer Controls → Generate Live Key)",
          RAZORPAYX_KEY_SECRET: "(live secret from the same key pair)",
          RAZORPAYX_ACCOUNT_NUMBER:
            "(Current Account no. from Settings → Banking, or Lite Customer Identifier)",
          RAZORPAYX_PAYOUT_MODE: "IMPS",
          RAZORPAYX_WEBHOOK_SECRET:
            "(optional — pick any password in Razorpay webhook setup, paste same here)",
          RAZORPAYX_RELAY_URL:
            "http://YOUR_VPS_IP:8787 (add with RAZORPAYX_RELAY_SECRET for IP whitelist)",
          RAZORPAYX_RELAY_SECRET:
            "(move keys to VPS — see relay/SETUP.md in the repo)",
        },
    webhookUrl: "https://reimburse-jade.vercel.app/api/webhooks/razorpayx",
  });
}
