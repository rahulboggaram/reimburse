import { requireAdminAccess } from "@/lib/auth-api";
import { getEmailOtpConfig, sendOtpEmail } from "@/lib/email";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/db";
import { getAisensyOtpConfig } from "@/lib/aisensy-otp";
import { sendWhatsappOtp, SmsConfigError, SmsDeliveryError } from "@/lib/sms";
import { getWhatsappOtpConfig } from "@/lib/whatsapp-otp";
import { EmailConfigError, EmailDeliveryError } from "@/lib/otp";
import { z } from "zod";

const bodySchema = z.object({
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional(),
});

/** Send one test OTP (email or WhatsApp). Admin only. Ignores OTP_MOCK. */
export async function POST(request: Request) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid phone number or email." }, { status: 400 });
  }

  const emailConfig = getEmailOtpConfig();
  const aisensy = getAisensyOtpConfig();
  const meta = getWhatsappOtpConfig();
  const code = String(Math.floor(100000 + Math.random() * 900000));

  if (parsed.data.email && emailConfig.configured) {
    try {
      await sendOtpEmail(parsed.data.email.trim().toLowerCase(), code);
      return Response.json({
        ok: true,
        channel: "email",
        destination: parsed.data.email.trim().toLowerCase(),
        message: "Test code sent by email. Check your inbox in a few seconds.",
      });
    } catch (err) {
      if (err instanceof EmailConfigError || err instanceof EmailDeliveryError) {
        return Response.json({ error: err.message }, { status: 502 });
      }
      console.error("email test send failed", err);
      return Response.json({ error: "Could not send test OTP email." }, { status: 500 });
    }
  }

  if (!parsed.data.phone) {
    return Response.json(
      {
        error: emailConfig.configured
          ? "Enter an email address to test email OTP."
          : "Enter a phone number to test WhatsApp OTP.",
      },
      { status: 400 },
    );
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return Response.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
  }

  if (emailConfig.configured) {
    const user = await prisma.user.findUnique({
      where: { phone },
      select: { email: true },
    });
    if (user?.email) {
      try {
        await sendOtpEmail(user.email, code);
        return Response.json({
          ok: true,
          phone,
          channel: "email",
          destination: user.email,
          message: `Test code sent to ${user.email}. Check inbox in a few seconds.`,
        });
      } catch (err) {
        if (err instanceof EmailConfigError || err instanceof EmailDeliveryError) {
          return Response.json({ error: err.message }, { status: 502 });
        }
        console.error("email test send failed", err);
        return Response.json({ error: "Could not send test OTP email." }, { status: 500 });
      }
    }
  }

  if (!aisensy.configured && !meta.configured) {
    return Response.json(
      {
        error: emailConfig.configured
          ? "This person has no work email on file. Add one in People, or configure WhatsApp vars."
          : "OTP delivery not configured. Add Resend (RESEND_API_KEY + OTP_EMAIL_FROM) or WhatsApp vars on Vercel, then redeploy.",
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
