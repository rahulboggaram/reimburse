/**
 * Check Meta WhatsApp credentials before turning off OTP_MOCK.
 *
 * Usage (from project root):
 *   npx tsx scripts/whatsapp-check.ts
 *   npx tsx scripts/whatsapp-check.ts 9876543210   # optional test send
 *
 * Reads WHATSAPP_* from .env in the project root.
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

async function main() {
  loadDotEnv();

  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const template = process.env.WHATSAPP_OTP_TEMPLATE_NAME?.trim();
  const version = process.env.WHATSAPP_API_VERSION?.trim() || "v25.0";

  console.log("\nReimburse — Meta WhatsApp check\n");

  if (!token) {
    console.log("✗ WHATSAPP_ACCESS_TOKEN missing in .env");
    console.log("  Get a system user token: business.facebook.com → Settings → System users\n");
    process.exit(1);
  }
  if (!phoneId) {
    console.log("✗ WHATSAPP_PHONE_NUMBER_ID missing in .env");
    console.log("  Meta app → WhatsApp → API Setup → select Yellow Metal +91 → copy Phone number ID\n");
    process.exit(1);
  }
  if (!template) {
    console.log("✗ WHATSAPP_OTP_TEMPLATE_NAME missing (use reimburse_login_otp)\n");
    process.exit(1);
  }

  console.log("✓ Env vars present");
  console.log(`  Template: ${template}`);
  console.log(`  API: ${version}\n`);

  const probeUrl = `https://graph.facebook.com/${version}/${phoneId}?fields=display_phone_number,status,code_verification_status`;
  const probeRes = await fetch(probeUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const probe = (await probeRes.json()) as {
    display_phone_number?: string;
    status?: string;
    code_verification_status?: string;
    error?: { message?: string; error_user_msg?: string };
  };

  if (!probeRes.ok) {
    console.log("✗ Meta rejected your token or phone number ID:");
    console.log(`  ${probe.error?.error_user_msg ?? probe.error?.message ?? probeRes.status}\n`);
    console.log("  Fix: use a system user token + Yellow Metal phone ID (not US test number).\n");
    process.exit(1);
  }

  console.log("✓ Meta sees your sender:");
  console.log(`  Number: ${probe.display_phone_number ?? "—"}`);
  console.log(`  Status: ${probe.status ?? "—"}`);
  console.log(`  Verification: ${probe.code_verification_status ?? "—"}\n`);

  if (probe.status === "PENDING") {
    console.log("⚠ Number is PENDING — register it in Meta (README Step 4) before OTP will work.\n");
  }

  const testPhone = process.argv[2]?.replace(/\D/g, "");
  if (!testPhone) {
    console.log("Optional: send a test OTP to your phone:");
    console.log("  npx tsx scripts/whatsapp-check.ts 9876543210\n");
    process.exit(probe.status === "PENDING" ? 1 : 0);
  }

  const to = testPhone.length === 10 ? `91${testPhone}` : testPhone;
  const code = "123456";
  const lang = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE?.trim() || "en";
  const includeButton =
    process.env.WHATSAPP_OTP_TEMPLATE_HAS_BUTTON?.trim().toLowerCase() !== "false";

  const components: Record<string, unknown>[] = [
    { type: "body", parameters: [{ type: "text", text: code }] },
  ];
  if (includeButton) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: code }],
    });
  }

  console.log(`Sending test template to ${to}…\n`);

  const sendRes = await fetch(
    `https://graph.facebook.com/${version}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: lang },
          components,
        },
      }),
    },
  );

  const sendPayload = (await sendRes.json()) as {
    messages?: { id: string }[];
    error?: { message?: string; error_user_msg?: string };
  };

  if (!sendRes.ok) {
    console.log("✗ Send failed:");
    console.log(`  ${sendPayload.error?.error_user_msg ?? sendPayload.error?.message}\n`);
    console.log("  Common fixes:");
    console.log("  • App In development → add your phone under API Setup → To");
    console.log("  • Wrong language → try WHATSAPP_OTP_TEMPLATE_LANGUAGE=en_US");
    console.log("  • Number not registered → run register curl (README Step 4)\n");
    process.exit(1);
  }

  console.log("✓ Test message accepted by Meta.");
  console.log(`  Message id: ${sendPayload.messages?.[0]?.id ?? "—"}`);
  console.log("  Check WhatsApp on your phone (from Yellow Metal +91).\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
