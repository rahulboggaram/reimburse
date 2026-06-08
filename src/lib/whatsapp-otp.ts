import { getAisensyOtpConfig, type AisensyOtpConfig } from "@/lib/aisensy-otp";
import { isOtpMockMode } from "@/lib/otp";
import { getOtpDeliveryChannel } from "@/lib/sms";

export type WhatsappOtpConfig = {
  mockMode: boolean;
  configured: boolean;
  hasToken: boolean;
  hasPhoneNumberId: boolean;
  templateName: string | null;
  languageCode: string;
  apiVersion: string;
  hasCopyButton: boolean;
};

export function getWhatsappOtpConfig(): WhatsappOtpConfig {
  const hasToken = Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim());
  const hasPhoneNumberId = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME?.trim() ?? null;

  return {
    mockMode: isOtpMockMode(),
    configured: Boolean(hasToken && hasPhoneNumberId && templateName),
    hasToken,
    hasPhoneNumberId,
    templateName,
    languageCode:
      process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE?.trim() || "en",
    apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || "v25.0",
    hasCopyButton:
      process.env.WHATSAPP_OTP_TEMPLATE_HAS_BUTTON?.trim().toLowerCase() !==
      "false",
  };
}

type PhoneProbe = {
  ok: boolean;
  displayPhoneNumber?: string;
  status?: string;
  codeVerificationStatus?: string;
  error?: string;
};

/** Check Meta can see the sender phone (valid token + phone number ID). */
export async function probeWhatsappSender(): Promise<PhoneProbe> {
  const config = getWhatsappOtpConfig();
  if (!config.hasToken || !config.hasPhoneNumberId) {
    return { ok: false, error: "Missing token or phone number ID in env vars." };
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN!.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  const url = `https://graph.facebook.com/${config.apiVersion}/${phoneNumberId}?fields=display_phone_number,status,code_verification_status`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as {
      display_phone_number?: string;
      status?: string;
      code_verification_status?: string;
      error?: { message?: string; error_user_msg?: string };
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        error:
          payload?.error?.error_user_msg ??
          payload?.error?.message ??
          `Meta returned ${response.status}`,
      };
    }

    return {
      ok: true,
      displayPhoneNumber: payload?.display_phone_number,
      status: payload?.status,
      codeVerificationStatus: payload?.code_verification_status,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not reach Meta API.",
    };
  }
}

export type WhatsappSetupStatus = {
  config: WhatsappOtpConfig;
  channel: string | null;
  sender: PhoneProbe | null;
  ready: boolean;
  provider: "aisensy" | "meta" | null;
  aisensy: AisensyOtpConfig | null;
};

export async function getWhatsappSetupStatus(): Promise<WhatsappSetupStatus> {
  const config = getWhatsappOtpConfig();
  const aisensy = getAisensyOtpConfig();

  if (aisensy.configured) {
    return {
      config,
      channel: config.mockMode ? null : getOtpDeliveryChannel(),
      sender: {
        ok: true,
        displayPhoneNumber: "AiSensy (WhatsApp)",
        status: "CONNECTED",
      },
      ready: !config.mockMode,
      provider: "aisensy",
      aisensy,
    };
  }

  const sender = config.configured ? await probeWhatsappSender() : null;
  const ready =
    !config.mockMode &&
    config.configured &&
    sender?.ok === true &&
    sender.status !== "PENDING";

  return {
    config,
    channel: config.mockMode ? null : getOtpDeliveryChannel(),
    sender,
    ready,
    provider: config.configured ? "meta" : null,
    aisensy: null,
  };
}
