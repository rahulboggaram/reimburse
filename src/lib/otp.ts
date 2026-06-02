import { prisma } from "@/lib/db";

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

export async function createOtpChallenge(phone: string) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpChallenge.deleteMany({ where: { phone } });
  await prisma.otpChallenge.create({
    data: { phone, code, expiresAt },
  });

  if (isOtpMockMode()) {
    console.log(`[Reimburse OTP] ${phone} → ${code}`);
  }

  return { code, expiresAt };
}

export async function verifyOtpChallenge(phone: string, code: string) {
  const trimmed = code.trim();

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
}

/** SMS body format for Web OTP autofill (Chrome on Android). */
export function otpSmsBody(code: string): string {
  const domain = process.env.NEXT_PUBLIC_OTP_DOMAIN ?? "reimburse.local";
  return `Your Reimburse code is ${code}\n\n@${domain} #${code}`;
}
