/** SMS delivery for live OTP (when OTP_MOCK is false). */

export class SmsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmsConfigError";
  }
}

export class SmsDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmsDeliveryError";
  }
}

type SmsProvider = "msg91" | "twilio";

function resolveProvider(): SmsProvider | null {
  if (process.env.MSG91_AUTH_KEY?.trim() && process.env.MSG91_TEMPLATE_ID?.trim()) {
    return "msg91";
  }
  if (
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    process.env.TWILIO_FROM_NUMBER?.trim()
  ) {
    return "twilio";
  }
  return null;
}

export function isSmsConfigured(): boolean {
  return resolveProvider() !== null;
}

function msg91Mobile(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function sendViaMsg91(phoneE164: string, otp: string) {
  const authkey = process.env.MSG91_AUTH_KEY!.trim();
  const templateId = process.env.MSG91_TEMPLATE_ID!.trim();
  const mobile = msg91Mobile(phoneE164);

  const response = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: {
      authkey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: templateId,
      mobile,
      otp,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    type?: string;
    message?: string;
  } | null;

  if (!response.ok) {
    const detail = payload?.message ?? `MSG91 error (${response.status})`;
    throw new SmsDeliveryError(detail);
  }

  if (payload?.type === "error") {
    throw new SmsDeliveryError(payload.message ?? "MSG91 could not send OTP.");
  }
}

async function sendViaTwilio(phoneE164: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN!.trim();
  const from = process.env.TWILIO_FROM_NUMBER!.trim();

  const params = new URLSearchParams({
    To: phoneE164,
    From: from,
    Body: body,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );

  const payload = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;

  if (!response.ok) {
    throw new SmsDeliveryError(
      payload?.message ?? `Twilio error (${response.status})`,
    );
  }
}

/** Send OTP SMS in live mode. No-op when SMS is not configured (caller should guard). */
export async function sendOtpSms(phoneE164: string, otp: string, smsBody: string) {
  const provider = resolveProvider();
  if (!provider) {
    throw new SmsConfigError(
      "SMS is not configured. Add MSG91 or Twilio env vars on the server, or set OTP_MOCK=true for demo login.",
    );
  }

  if (provider === "msg91") {
    await sendViaMsg91(phoneE164, otp);
    return;
  }

  await sendViaTwilio(phoneE164, smsBody);
}
