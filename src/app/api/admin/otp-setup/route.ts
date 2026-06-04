import { requireAdminAccess } from "@/lib/auth-api";
import { getOtpDeliveryChannel } from "@/lib/otp";
import { getWhatsappOtpConfig, probeWhatsappSender } from "@/lib/whatsapp-otp";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const config = getWhatsappOtpConfig();
  const sender =
    config.configured && !config.mockMode ? await probeWhatsappSender() : null;

  const ready =
    !config.mockMode &&
    config.configured &&
    sender?.ok === true &&
    sender.status !== "PENDING";

  return Response.json({
    config,
    channel: config.mockMode ? null : getOtpDeliveryChannel(),
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
