import { prisma } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import {
  EmailConfigError,
  EmailDeliveryError,
  isEmailOtpConfigured,
  sendOtpEmail,
} from "@/lib/email";

export { EmailConfigError, EmailDeliveryError };

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

async function deliverOtpEmail(to: string, code: string, challengeKey: string) {
  if (!isEmailOtpConfigured()) {
    await prisma.otpChallenge.deleteMany({ where: { phone: challengeKey } });
    throw new EmailConfigError(
      "Live OTP is on but email is not configured. Add POSTMARK_SERVER_TOKEN and OTP_EMAIL_FROM on Vercel, or set OTP_MOCK=true.",
    );
  }

  try {
    await sendOtpEmail(to, code);
  } catch (error) {
    await prisma.otpChallenge.deleteMany({ where: { phone: challengeKey } });
    throw error;
  }
}

/** Login and email-change OTP — keyed by normalized email, delivered to that inbox. */
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

  await deliverOtpEmail(normalized, code, normalized);
  return { code, expiresAt };
}

/** Phone-change OTP — keyed by new phone, delivered to the user's email on file. */
export async function createOtpChallenge(phone: string, deliveryEmail: string) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const email = deliveryEmail.trim().toLowerCase();

  await withDbRetry(async () => {
    await prisma.otpChallenge.deleteMany({ where: { phone } });
    await prisma.otpChallenge.create({
      data: { phone, code, expiresAt },
    });
  });

  if (isOtpMockMode()) {
    console.log(`[Reimburse OTP] ${phone} → ${code} (email: ${email})`);
    return { code, expiresAt };
  }

  await deliverOtpEmail(email, code, phone);
  return { code, expiresAt };
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
