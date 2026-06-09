import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env optional when vars are already exported
  }
}

loadEnv();

const keyId = (process.env.RAZORPAYX_KEY_ID ?? "").trim();
const keySecret = (process.env.RAZORPAYX_KEY_SECRET ?? "").trim();
const accountNumber = (process.env.RAZORPAYX_ACCOUNT_NUMBER ?? "").trim();
const mock = /^(true|1|yes)$/i.test((process.env.RAZORPAYX_MOCK ?? "").trim());

const mode = !keyId
  ? "unconfigured"
  : mock && !(keyId && keySecret && accountNumber)
    ? "mock"
    : keyId.startsWith("rzp_live_")
      ? "live"
      : "test";

console.log(
  JSON.stringify(
    {
      mode,
      mock,
      keyIdPrefix: keyId ? `${keyId.slice(0, 12)}…` : null,
      accountNumber: accountNumber || null,
      webhookSecretSet: Boolean((process.env.RAZORPAYX_WEBHOOK_SECRET ?? "").trim()),
    },
    null,
    2,
  ),
);

if (mock || !keyId || !keySecret || !accountNumber) {
  console.error(
    "\nNot probing API — set RAZORPAYX_MOCK=false and add keys + account number.",
  );
  process.exit(1);
}

const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
const account = encodeURIComponent(accountNumber);
const response = await fetch(
  `https://api.razorpay.com/v1/payouts?account_number=${account}&count=1`,
  {
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
    },
  },
);

const body = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(
    "\nRazorpay probe failed:",
    body.error?.description ?? body.error?.reason ?? response.status,
  );
  process.exit(1);
}

console.log("\nRazorpayX API connection OK.");
