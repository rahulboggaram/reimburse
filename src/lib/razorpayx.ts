import { createHmac, randomUUID } from "node:crypto";

const API_BASE = "https://api.razorpay.com/v1";

export type RazorpayPayoutResponse = {
  id: string;
  status: string;
  utr?: string | null;
  fund_account_id?: string;
  fund_account?: {
    id: string;
    contact_id?: string;
    contact?: { id: string };
  };
  error?: {
    description?: string | null;
    reason?: string | null;
  };
  status_details?: {
    description?: string | null;
  };
};

export type RazorpayConfig = {
  enabled: boolean;
  mock: boolean;
  keyId: string;
  keySecret: string;
  accountNumber: string;
  payoutMode: "IMPS" | "NEFT" | "RTGS";
  webhookSecret: string | null;
};

export function getRazorpayConfig(): RazorpayConfig {
  const mock = process.env.RAZORPAYX_MOCK === "true";
  const keyId = process.env.RAZORPAYX_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAYX_KEY_SECRET ?? "";
  const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER ?? "";
  const payoutMode =
    process.env.RAZORPAYX_PAYOUT_MODE === "NEFT" ||
    process.env.RAZORPAYX_PAYOUT_MODE === "RTGS"
      ? process.env.RAZORPAYX_PAYOUT_MODE
      : "IMPS";

  return {
    enabled: mock || Boolean(keyId && keySecret && accountNumber),
    mock,
    keyId,
    keySecret,
    accountNumber,
    payoutMode,
    webhookSecret: process.env.RAZORPAYX_WEBHOOK_SECRET ?? null,
  };
}

function authHeader(config: RazorpayConfig) {
  const token = Buffer.from(`${config.keyId}:${config.keySecret}`).toString(
    "base64",
  );
  return `Basic ${token}`;
}

async function razorpayRequest<T>(
  config: RazorpayConfig,
  path: string,
  init: RequestInit & { idempotencyKey?: string },
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", authHeader(config));
  headers.set("Content-Type", "application/json");
  if (init.idempotencyKey) {
    headers.set("X-Payout-Idempotency", init.idempotencyKey);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const body = (await response.json()) as T & {
    error?: { description?: string; reason?: string };
  };

  if (!response.ok) {
    const message =
      body.error?.description ??
      body.error?.reason ??
      `RazorpayX request failed (${response.status})`;
    throw new Error(message);
  }

  return body;
}

export function rupeesToPaise(amount: number) {
  return Math.round(amount * 100);
}

export async function fetchPayoutById(payoutId: string) {
  const config = getRazorpayConfig();
  if (!config.enabled) {
    throw new Error("RazorpayX is not configured.");
  }
  if (config.mock) {
    return {
      id: payoutId,
      status: "processed",
      utr: `MOCK${Date.now().toString().slice(-8)}`,
    } satisfies RazorpayPayoutResponse;
  }
  return razorpayRequest<RazorpayPayoutResponse>(config, `/payouts/${payoutId}`, {
    method: "GET",
  });
}

export function sanitizeNarration(text: string) {
  return text.replace(/[^a-zA-Z0-9 ]/g, " ").trim().slice(0, 30);
}

export function payoutReferenceId(claimId: string) {
  return claimId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
}

export async function createReimbursementPayout(input: {
  claimId: string;
  amount: number;
  employeeName: string;
  employeePhone: string;
  employeeId: string;
  ifscCode: string;
  bankAccountNumber: string;
  category: string;
  idempotencyKey?: string;
}): Promise<{
  payout: RazorpayPayoutResponse;
  contactId: string | null;
  fundAccountId: string | null;
}> {
  const config = getRazorpayConfig();
  if (!config.enabled) {
    throw new Error(
      "RazorpayX is not configured. Add API keys to .env or set RAZORPAYX_MOCK=true for demo payouts.",
    );
  }

  if (config.mock) {
    const mockId = `pout_mock_${randomUUID().slice(0, 8)}`;
    return {
      payout: {
        id: mockId,
        status: "processed",
        utr: `MOCK${Date.now().toString().slice(-8)}`,
        fund_account_id: `fa_mock_${input.employeeId.slice(0, 8)}`,
        fund_account: {
          id: `fa_mock_${input.employeeId.slice(0, 8)}`,
          contact_id: `cont_mock_${input.employeeId.slice(0, 8)}`,
          contact: { id: `cont_mock_${input.employeeId.slice(0, 8)}` },
        },
      },
      contactId: `cont_mock_${input.employeeId.slice(0, 8)}`,
      fundAccountId: `fa_mock_${input.employeeId.slice(0, 8)}`,
    };
  }

  const amountPaise = rupeesToPaise(input.amount);
  if (amountPaise < 100) {
    throw new Error("Payout amount must be at least ₹1.");
  }

  const phoneDigits = input.employeePhone.replace(/\D/g, "").slice(-10);
  const payout = await razorpayRequest<RazorpayPayoutResponse>(
    config,
    "/payouts",
    {
      method: "POST",
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
      body: JSON.stringify({
        account_number: config.accountNumber,
        amount: amountPaise,
        currency: "INR",
        mode: config.payoutMode,
        purpose: "refund",
        queue_if_low_balance: true,
        reference_id: payoutReferenceId(input.claimId),
        narration: sanitizeNarration(`Wapas ${input.category}`),
        notes: {
          claim_id: input.claimId,
          employee_id: input.employeeId,
        },
        fund_account: {
          account_type: "bank_account",
          bank_account: {
            name: input.employeeName,
            ifsc: input.ifscCode.toUpperCase(),
            account_number: input.bankAccountNumber,
          },
          contact: {
            name: input.employeeName,
            email: `${phoneDigits}@wapas.local`,
            contact: phoneDigits,
            type: "employee",
            reference_id: input.employeeId,
          },
        },
      }),
    },
  );

  return {
    payout,
    contactId: payout.fund_account?.contact?.id ?? null,
    fundAccountId: payout.fund_account_id ?? payout.fund_account?.id ?? null,
  };
}

export function isPayoutSuccessful(status: string) {
  return status === "processed";
}

export function isPayoutInProgress(status: string) {
  return ["queued", "pending", "processing"].includes(status);
}

export function isPayoutFailed(status: string) {
  return ["failed", "rejected", "cancelled", "reversed"].includes(status);
}

export function payoutErrorMessage(payout: RazorpayPayoutResponse) {
  return (
    payout.status_details?.description ??
    payout.error?.description ??
    payout.error?.reason ??
    "Payout failed"
  );
}

export function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string,
) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

export type RazorpayWebhookPayload = {
  event: string;
  payload?: {
    payout?: {
      entity?: RazorpayPayoutResponse & { reference_id?: string };
    };
  };
};
