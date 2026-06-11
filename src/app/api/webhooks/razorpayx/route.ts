import { after } from "next/server";
import { prisma } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import { queuePayoutSync, syncPayoutFromWebhook } from "@/lib/payouts";
import {
  getRazorpayConfig,
  verifyWebhookSignature,
  type RazorpayPayoutResponse,
  type RazorpayWebhookPayload,
} from "@/lib/razorpayx";

export const maxDuration = 60;

const RELEVANT_PAYOUT_EVENTS = new Set([
  "payout.processed",
  "payout.failed",
  "payout.reversed",
  "payout.queued",
  "payout.pending",
  "payout.processing",
  "payout.rejected",
]);

// Razorpay's webhook "verification" often probes the URL with GET/HEAD.
// Keep it lightweight so the dashboard can validate connectivity.
export async function GET() {
  return Response.json({ ok: true });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

function queuePayoutSyncFallback(payoutId: string) {
  void prisma.reimbursement
    .findFirst({
      where: { razorpayPayoutId: payoutId },
      select: { id: true },
    })
    .then((claim) => {
      if (claim) queuePayoutSync([claim.id]);
    })
    .catch((fallbackErr) => {
      console.error("[razorpayx webhook] fallback queue failed", {
        payoutId,
        error:
          fallbackErr instanceof Error ? fallbackErr.message : fallbackErr,
      });
    });
}

function processPayoutWebhookInBackground(
  event: string,
  payout: RazorpayPayoutResponse,
) {
  after(async () => {
    try {
      await withDbRetry(() => syncPayoutFromWebhook(payout), {
        retries: 3,
        delayMs: 500,
      });
    } catch (err) {
      console.error("[razorpayx webhook] payout sync failed", {
        event,
        payoutId: payout.id,
        error: err instanceof Error ? err.message : err,
      });
      queuePayoutSyncFallback(payout.id);
    }
  });
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

  if (!RELEVANT_PAYOUT_EVENTS.has(payload.event)) {
    return Response.json({ received: true });
  }

  // Acknowledge immediately so Razorpay does not mark delivery as failed.
  // Payout status is applied in the background; polling is the fallback.
  processPayoutWebhookInBackground(payload.event, payout);
  return Response.json({ received: true });
}
