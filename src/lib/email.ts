/** Login OTP delivery via Postmark (https://postmarkapp.com). */

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/** e.g. ra***@yellowmetal.com */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

export function getEmailOtpConfig() {
  const serverToken = process.env.POSTMARK_SERVER_TOKEN?.trim() ?? "";
  const from = process.env.OTP_EMAIL_FROM?.trim() ?? "";
  return {
    serverToken,
    from,
    configured: Boolean(serverToken && from),
  };
}

export function isEmailOtpConfigured(): boolean {
  return getEmailOtpConfig().configured;
}

export async function sendOtpEmail(to: string, code: string) {
  const config = getEmailOtpConfig();
  if (!config.configured) {
    throw new EmailConfigError(
      "Email OTP is not configured. Add POSTMARK_SERVER_TOKEN and OTP_EMAIL_FROM on Vercel.",
    );
  }

  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": config.serverToken,
    },
    body: JSON.stringify({
      From: config.from,
      To: to,
      Subject: `${code} is your Reimburse login code`,
      HtmlBody: otpEmailHtml(code),
      TextBody: otpEmailText(code),
      MessageStream: "outbound",
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    Message?: string;
    ErrorCode?: number;
  } | null;

  if (!response.ok || (payload?.ErrorCode ?? 0) !== 0) {
    throw new EmailDeliveryError(
      payload?.Message ?? `Postmark error (${response.status})`,
    );
  }
}

function otpEmailText(code: string): string {
  return [
    "Your Reimburse login code",
    "",
    code,
    "",
    "This code expires in 10 minutes.",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
}

function otpEmailHtml(code: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b; line-height: 1.5;">
    <p style="margin: 0 0 16px;">Your Reimburse login code is:</p>
    <p style="margin: 0 0 16px; font-size: 32px; font-weight: 700; letter-spacing: 0.2em;">${code}</p>
    <p style="margin: 0; color: #71717a; font-size: 14px;">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
  </body>
</html>`;
}
