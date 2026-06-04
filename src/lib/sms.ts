/** OTP delivery via WhatsApp, SMS (MSG91), or Twilio when OTP_MOCK is false. */

export type OtpDeliveryChannel = "whatsapp" | "sms";

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

type OtpProvider = "whatsapp" | "msg91" | "twilio";

function resolveProvider(): OtpProvider | null {
  if (
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
    process.env.WHATSAPP_OTP_TEMPLATE_NAME?.trim()
  ) {
    return "whatsapp";
  }
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

export function getOtpDeliveryChannel(): OtpDeliveryChannel | null {
  const provider = resolveProvider();
  if (!provider) return null;
  return provider === "whatsapp" ? "whatsapp" : "sms";
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

function whatsappApiVersion() {
  return process.env.WHATSAPP_API_VERSION?.trim() || "v25.0";
}

function whatsappRecipient(phoneE164: string) {
  return phoneE164.replace(/\D/g, "");
}

/** Meta authentication template (copy-code button). */
async function sendViaWhatsapp(phoneE164: string, otp: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN!.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME!.trim();
  const languageCode =
    process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE?.trim() || "en";
  const includeButton =
    process.env.WHATSAPP_OTP_TEMPLATE_HAS_BUTTON?.trim().toLowerCase() !==
    "false";

  const components: Record<string, unknown>[] = [
    {
      type: "body",
      parameters: [{ type: "text", text: otp }],
    },
  ];

  if (includeButton) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: otp }],
    });
  }

  const response = await fetch(
    `https://graph.facebook.com/${whatsappApiVersion()}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: whatsappRecipient(phoneE164),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    },
  );

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string; error_user_msg?: string };
  } | null;

  if (!response.ok) {
    const detail =
      payload?.error?.error_user_msg ??
      payload?.error?.message ??
      `WhatsApp error (${response.status})`;
    throw new SmsDeliveryError(detail);
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

/** Send OTP in live mode (WhatsApp or SMS). Caller should guard with isSmsConfigured(). */
export async function sendOtpSms(phoneE164: string, otp: string, smsBody: string) {
  const provider = resolveProvider();
  if (!provider) {
    throw new SmsConfigError(
      "OTP delivery is not configured. Add WhatsApp, MSG91, or Twilio env vars, or set OTP_MOCK=true.",
    );
  }

  if (provider === "whatsapp") {
    await sendViaWhatsapp(phoneE164, otp);
    return;
  }

  if (provider === "msg91") {
    await sendViaMsg91(phoneE164, otp);
    return;
  }

  await sendViaTwilio(phoneE164, smsBody);
}
