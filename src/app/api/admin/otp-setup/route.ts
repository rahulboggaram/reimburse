import { requireAdminAccess } from "@/lib/auth-api";
import { isOtpMockMode } from "@/lib/otp";
import { getWhatsappOtpConfig, getWhatsappSetupStatus } from "@/lib/whatsapp-otp";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const config = getWhatsappOtpConfig();
  const status = await getWhatsappSetupStatus();
  const mockMode = isOtpMockMode();

  const vercelVars =
    status.provider === "aisensy" && status.aisensy
      ? {
          OTP_MOCK: "false",
          NEXT_PUBLIC_OTP_MOCK: "false",
          NEXT_PUBLIC_OTP_DOMAIN: "reimburse-jade.vercel.app",
          AISENSY_API_KEY: "(from AiSensy → Manage → API Key)",
          AISENSY_CAMPAIGN_NAME: status.aisensy.campaignName ?? "(live API campaign name)",
          AISENSY_TEMPLATE_PARAM_COUNT: String(
            status.aisensy.templateParamCount,
          ),
        }
      : {
          OTP_MOCK: "false",
          NEXT_PUBLIC_OTP_MOCK: "false",
          NEXT_PUBLIC_OTP_DOMAIN: "reimburse-jade.vercel.app",
          WHATSAPP_ACCESS_TOKEN: "(system user token from Meta)",
          WHATSAPP_PHONE_NUMBER_ID: "(Yellow Metal +91 — not US test number)",
          WHATSAPP_OTP_TEMPLATE_NAME: "reimburse_login_otp",
          WHATSAPP_OTP_TEMPLATE_LANGUAGE: config.languageCode,
          WHATSAPP_OTP_TEMPLATE_HAS_BUTTON: "true",
          WHATSAPP_API_VERSION: config.apiVersion,
        };

  return Response.json({
    ...status,
    ready: mockMode || status.ready,
    channel: mockMode ? null : status.channel,
    vercelVars,
  });
}
