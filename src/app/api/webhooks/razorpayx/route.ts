import {
  getRazorpayConfig,
  verifyWebhookSignature,
  type RazorpayWebhookPayload,
} from "@/lib/razorpayx";
import { syncPayoutFromWebhook } from "@/lib/payouts";

// Razorpay's webhook "verification" often probes the URL with GET/HEAD.
// Keep it lightweight so the dashboard can validate connectivity.
export async function GET() {
  return Response.json({ ok: true });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function POST(request: Request) {
  const config = getRazorpayConfig();
  const body = await request.text();

  if (config.webhookSecret) {
    const signature = request.headers.get("x-razorpay-signature");
    if (!verifyWebhookSignature(body, signature, config.webhookSecret)) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(body) as RazorpayWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payout = payload.payload?.payout?.entity;
  if (!payout?.id) {
    return Response.json({ received: true });
  }

  const relevantEvents = [
    "payout.processed",
    "payout.failed",
    "payout.reversed",
    "payout.queued",
    "payout.pending",
    "payout.processing",
    "payout.rejected",
  ];

  if (!relevantEvents.includes(payload.event)) {
    return Response.json({ received: true });
  }

  await syncPayoutFromWebhook(payout);
  return Response.json({ received: true });
}
