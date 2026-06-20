import { requireAdminAccess } from "@/lib/auth-api";
import { normalizePhone } from "@/lib/phone";
import { getAisensyOtpConfig } from "@/lib/aisensy-otp";
import { sendWhatsappOtp, SmsConfigError, SmsDeliveryError } from "@/lib/sms";
import { getWhatsappOtpConfig } from "@/lib/whatsapp-otp";
import { z } from "zod";

const bodySchema = z.object({
  phone: z.string().min(10).max(15),
});

/** Send one test OTP on WhatsApp. Admin only. Ignores OTP_MOCK. */
export async function POST(request: Request) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return Response.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
  }

  const aisensy = getAisensyOtpConfig();
  const meta = getWhatsappOtpConfig();
  const code = String(Math.floor(100000 + Math.random() * 900000));

  if (!aisensy.configured && !meta.configured) {
    return Response.json(
      {
        error: "OTP delivery not configured. Add WhatsApp vars on Vercel, then redeploy.",
      },
      { status: 503 },
    );
  }

  try {
    await sendWhatsappOtp(phone, code);
    return Response.json({
      ok: true,
      phone,
      channel: "whatsapp",
      message: aisensy.configured
        ? "Test code sent on WhatsApp via AiSensy. Check your phone in a few seconds."
        : "Test code sent on WhatsApp. If you do not receive it, add this number under Meta → API Setup → To (when app is In development).",
    });
  } catch (err) {
    if (err instanceof SmsConfigError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof SmsDeliveryError) {
      return Response.json({ error: err.message }, { status: 502 });
    }
    console.error("whatsapp test send failed", err);
    return Response.json({ error: "Could not send test OTP." }, { status: 500 });
  }
}
