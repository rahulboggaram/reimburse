export type AisensyOtpConfig = {
  configured: boolean;
  hasApiKey: boolean;
  campaignName: string | null;
  apiUrl: string;
  templateParamCount: number;
};

export function getAisensyOtpConfig(): AisensyOtpConfig {
  const hasApiKey = Boolean(process.env.AISENSY_API_KEY?.trim());
  const campaignName = process.env.AISENSY_CAMPAIGN_NAME?.trim() ?? null;
  const paramCountRaw =
    process.env.AISENSY_TEMPLATE_PARAM_COUNT?.trim() || "1";
  const templateParamCount = Math.max(
    1,
    Math.min(4, Number.parseInt(paramCountRaw, 10) || 1),
  );

  return {
    configured: Boolean(hasApiKey && campaignName),
    hasApiKey,
    campaignName,
    apiUrl:
      process.env.AISENSY_API_URL?.trim() ||
      "https://backend.aisensy.com/campaign/t1/api/v2",
    templateParamCount,
  };
}

function aisensyDestination(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/** Send login OTP via AiSensy API campaign (WhatsApp authentication template). */
export async function sendAisensyOtp(phoneE164: string, otp: string) {
  const config = getAisensyOtpConfig();
  if (!config.configured) {
    throw new Error(
      "AiSensy is not configured. Set AISENSY_API_KEY and AISENSY_CAMPAIGN_NAME.",
    );
  }

  const templateParams = Array.from(
    { length: config.templateParamCount },
    () => otp,
  );

  const body = {
    apiKey: process.env.AISENSY_API_KEY!.trim(),
    campaignName: config.campaignName!,
    destination: aisensyDestination(phoneE164),
    userName: process.env.AISENSY_USER_NAME?.trim() || "User",
    templateParams,
  };

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    error?: string;
    status?: string;
  } | null;

  if (!response.ok) {
    throw new Error(
      payload?.message ??
        payload?.error ??
        `AiSensy error (${response.status})`,
    );
  }

  if (payload?.success === false) {
    throw new Error(
      payload.message ?? payload.error ?? "AiSensy could not send OTP.",
    );
  }
}
