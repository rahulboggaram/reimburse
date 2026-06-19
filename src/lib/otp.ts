import { prisma } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import {
  EmailConfigError,
  EmailDeliveryError,
  isEmailOtpConfigured,
  sendOtpEmail,
} from "@/lib/email";
import {
  getOtpDeliveryChannel,
  sendOtpSms,
  SmsConfigError,
  SmsDeliveryError,
  type OtpDeliveryChannel,
} from "@/lib/sms";

export type { OtpDeliveryChannel };
export { getOtpDeliveryChannel };

export { SmsConfigError, SmsDeliveryError, EmailConfigError, EmailDeliveryError };

const OTP_TTL_MS = 10 * 60 * 1000;
export const MOCK_OTP_CODE = "123456";

export function isOtpMockMode(): boolean {
  const value = process.env.OTP_MOCK?.trim().toLowerCase();
  return value === "true" || value === "1" || value === '"true"';
}

function generateCode(): string {
  if (isOtpMockMode()) {
    return MOCK_OTP_CODE;
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Login OTP — keyed by normalized email, always delivered by email (or mock). */
export async function createLoginOtpChallenge(email: string) {
  const normalized = email.trim().toLowerCase();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await withDbRetry(async () => {
    await prisma.otpChallenge.deleteMany({ where: { phone: normalized } });
    await prisma.otpChallenge.create({
      data: { phone: normalized, code, expiresAt },
    });
  });

  if (isOtpMockMode()) {
    console.log(`[Reimburse OTP] ${normalized} → ${code}`);
    return { code, expiresAt };
  }

  if (!isEmailOtpConfigured()) {
    await prisma.otpChallenge.deleteMany({ where: { phone: normalized } });
    throw new EmailConfigError(
      "Live OTP is on but email is not configured. Add POSTMARK_SERVER_TOKEN and OTP_EMAIL_FROM on Vercel, or set OTP_MOCK=true.",
    );
  }

  try {
    await sendOtpEmail(normalized, code);
  } catch (error) {
    await prisma.otpChallenge.deleteMany({ where: { phone: normalized } });
    throw error;
  }

  return { code, expiresAt };
}

/** Phone change OTP — keyed by phone, delivered via SMS or WhatsApp. */
export async function createOtpChallenge(phone: string) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await withDbRetry(async () => {
    await prisma.otpChallenge.deleteMany({ where: { phone } });
    await prisma.otpChallenge.create({
      data: { phone, code, expiresAt },
    });
  });

  if (isOtpMockMode()) {
    console.log(`[Reimburse OTP] ${phone} → ${code}`);
    return { code, expiresAt, channel: null as OtpDeliveryChannel | null };
  }

  const channel = getOtpDeliveryChannel();

  if (!channel) {
    await prisma.otpChallenge.deleteMany({ where: { phone } });
    throw new SmsConfigError(
      "OTP delivery is not configured. Add WhatsApp, MSG91, or Twilio on Vercel, or set OTP_MOCK=true.",
    );
  }

  try {
    await sendOtpSms(phone, code, otpSmsBody(code));
  } catch (error) {
    await prisma.otpChallenge.deleteMany({ where: { phone } });
    throw error;
  }

  return { code, expiresAt, channel };
}

export async function verifyOtpChallenge(phone: string, code: string) {
  const trimmed = code.trim();

  return withDbRetry(async () => {
    if (isOtpMockMode() && trimmed === MOCK_OTP_CODE) {
      await prisma.otpChallenge.deleteMany({ where: { phone } });
      return true;
    }

    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge) return false;
    if (challenge.expiresAt < new Date()) return false;
    if (challenge.code !== trimmed) return false;

    await prisma.otpChallenge.delete({ where: { id: challenge.id } });
    return true;
  });
}

/** SMS body format for Web OTP autofill (Chrome on Android). */
export function otpSmsBody(code: string): string {
  const domain = process.env.NEXT_PUBLIC_OTP_DOMAIN ?? "reimburse.local";
  return `Your Reimburse code is ${code}\n\n@${domain} #${code}`;
}
