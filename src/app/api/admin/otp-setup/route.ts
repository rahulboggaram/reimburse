import { requireAdminAccess } from "@/lib/auth-api";
import { getEmailOtpConfig } from "@/lib/email";
import { isOtpMockMode } from "@/lib/otp";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const email = getEmailOtpConfig();
  const mockMode = isOtpMockMode();

  return Response.json({
    ready: mockMode || email.configured,
    mockMode,
    email: {
      configured: email.configured,
      from: email.from || null,
    },
    vercelVars: {
      OTP_MOCK: "false",
      NEXT_PUBLIC_OTP_MOCK: "false",
      POSTMARK_SERVER_TOKEN: "(from Postmark → Servers → API tokens)",
      OTP_EMAIL_FROM: email.from || "Reimburse <otp@yourdomain.com>",
    },
  });
}
