import { requireAdminAccess } from "@/lib/auth-api";
import { getWhatsappOtpConfig, getWhatsappSetupStatus } from "@/lib/whatsapp-otp";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const config = getWhatsappOtpConfig();
  const { channel, sender, ready } = await getWhatsappSetupStatus();

  return Response.json({
    config,
    channel,
    sender,
    ready,
    vercelVars: {
      OTP_MOCK: "false",
      NEXT_PUBLIC_OTP_MOCK: "false",
      NEXT_PUBLIC_OTP_DOMAIN: "reimburse-jade.vercel.app",
      WHATSAPP_ACCESS_TOKEN: "(system user token from Meta)",
      WHATSAPP_PHONE_NUMBER_ID: "(Yellow Metal +91 — not US test number)",
      WHATSAPP_OTP_TEMPLATE_NAME: "reimburse_login_otp",
      WHATSAPP_OTP_TEMPLATE_LANGUAGE: config.languageCode,
      WHATSAPP_OTP_TEMPLATE_HAS_BUTTON: "true",
      WHATSAPP_API_VERSION: config.apiVersion,
    },
  });
}
