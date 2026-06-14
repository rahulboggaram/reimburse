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
  isSmsConfigured,
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

function resolveLiveDeliveryChannel(email?: string | null): OtpDeliveryChannel | null {
  if (isEmailOtpConfigured() && email) {
    return "email";
  }
  return getOtpDeliveryChannel();
}

export function getOtpDeliveryChannelForUser(email?: string | null): OtpDeliveryChannel | null {
  if (isOtpMockMode()) return null;
  return resolveLiveDeliveryChannel(email);
}

export async function createOtpChallenge(
  phone: string,
  options?: { email?: string | null },
) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const userEmail = options?.email?.trim().toLowerCase() || null;

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

  const channel = resolveLiveDeliveryChannel(userEmail);

  if (!channel) {
    await prisma.otpChallenge.deleteMany({ where: { phone } });
    if (isEmailOtpConfigured() && !userEmail) {
      throw new EmailConfigError(
        "No email on file for this number. Ask your admin to add an email in People.",
      );
    }
    throw new SmsConfigError(
      "Live OTP is on but delivery is not configured. Add Resend email keys, WhatsApp, MSG91, or Twilio on Vercel, or set OTP_MOCK=true.",
    );
  }

  try {
    if (channel === "email" && userEmail) {
      await sendOtpEmail(userEmail, code);
    } else {
      await sendOtpSms(phone, code, otpSmsBody(code));
    }
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
