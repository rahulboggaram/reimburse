/**
 * Register +91 business line for WhatsApp Cloud API (Meta registration endpoint).
 *
 * Usage:
 *   Add to .env (never commit):
 *     WHATSAPP_ACCESS_TOKEN=...
 *     WHATSAPP_PHONE_NUMBER_ID=...   # Phone number ID for +91, NOT WABA id
 *     WHATSAPP_TWO_STEP_PIN=123456   # 6-digit PIN from WhatsApp Manager
 *
 *   npm run whatsapp:register
 *
 * Optional: pass PIN on command line (not saved):
 *   npm run whatsapp:register -- 123456
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

type Probe = {
  display_phone_number?: string;
  status?: string;
  code_verification_status?: string;
  error?: { message?: string; error_user_msg?: string; code?: number; error_subcode?: number };
};

async function probePhone(
  version: string,
  phoneId: string,
  token: string,
): Promise<{ ok: boolean; data: Probe; status: number }> {
  const url = `https://graph.facebook.com/${version}/${phoneId}?fields=display_phone_number,status,code_verification_status`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as Probe;
  return { ok: res.ok, data, status: res.status };
}

async function main() {
  loadDotEnv();

  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const pinArg = process.argv[2]?.replace(/\D/g, "");
  const pin = pinArg || process.env.WHATSAPP_TWO_STEP_PIN?.replace(/\D/g, "");
  const version = process.env.WHATSAPP_API_VERSION?.trim() || "v25.0";

  console.log("\nReimburse — Meta WhatsApp phone registration\n");

  if (!token) {
    console.log("✗ Add WHATSAPP_ACCESS_TOKEN to .env (system user token for Yellow Metal app)\n");
    process.exit(1);
  }
  if (!phoneId) {
    console.log("✗ Add WHATSAPP_PHONE_NUMBER_ID to .env");
    console.log("  Yellow Metal → WhatsApp → API Setup → From +91 → Phone number ID\n");
    process.exit(1);
  }

  console.log(`Checking phone number ID ${phoneId}…\n`);

  const before = await probePhone(version, phoneId, token);
  if (!before.ok) {
    console.log("✗ Cannot load this phone number ID with your token:");
    console.log(`  ${before.data.error?.error_user_msg ?? before.data.error?.message ?? before.status}`);
    console.log("\n  Usually means:");
    console.log("  • Wrong ID (WABA id or business id instead of Phone number ID)");
    console.log("  • Token missing whatsapp_business_management on this WhatsApp account");
    console.log("  • Use a system user token, not an expired user token\n");
    process.exit(1);
  }

  console.log("✓ Meta returned:");
  console.log(`  Number: ${before.data.display_phone_number ?? "—"}`);
  console.log(`  Status: ${before.data.status ?? "—"}`);
  console.log(`  Verification: ${before.data.code_verification_status ?? "—"}\n`);

  if (before.data.status === "CONNECTED") {
    console.log("✓ Already CONNECTED — registration not needed. Use npm run whatsapp:check to test send.\n");
    process.exit(0);
  }

  if (!pin || pin.length !== 6) {
    console.log("✗ Need 6-digit two-step verification PIN for this business number.");
    console.log("  Set WHATSAPP_TWO_STEP_PIN in .env or run: npm run whatsapp:register -- 123456\n");
    process.exit(1);
  }

  console.log("Registering with Meta Cloud API…\n");

  const registerRes = await fetch(
    `https://graph.facebook.com/${version}/${phoneId}/register`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin,
      }),
    },
  );

  const registerPayload = (await registerRes.json()) as {
    success?: boolean;
    error?: {
      message?: string;
      error_user_msg?: string;
      code?: number;
      error_subcode?: number;
    };
  };

  if (!registerRes.ok) {
    const msg =
      registerPayload.error?.error_user_msg ??
      registerPayload.error?.message ??
      `HTTP ${registerRes.status}`;
    console.log("✗ Registration failed:");
    console.log(`  ${msg}`);
    if (registerPayload.error?.error_subcode === 133005) {
      console.log("\n  PIN mismatch — use the 6-digit two-step PIN from WhatsApp Manager.\n");
    } else if (registerPayload.error?.code === 100) {
      console.log("\n  Wrong phone number ID or token cannot access this number.\n");
    }
    process.exit(1);
  }

  console.log("✓ Register response:", JSON.stringify(registerPayload));

  const after = await probePhone(version, phoneId, token);
  if (after.ok) {
    console.log("\nAfter register:");
    console.log(`  Status: ${after.data.status ?? "—"}`);
    console.log(`  Verification: ${after.data.code_verification_status ?? "—"}\n`);
  }

  console.log("Next: npm run whatsapp:check  OR  add vars to Vercel and redeploy.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
