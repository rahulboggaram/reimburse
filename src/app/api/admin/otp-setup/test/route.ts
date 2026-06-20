import { requireAdminAccess } from "@/lib/auth-api";
import { getEmailOtpConfig, sendOtpEmail } from "@/lib/email";
import { EmailConfigError, EmailDeliveryError } from "@/lib/otp";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email(),
});

/** Send one test OTP email. Admin only. Ignores OTP_MOCK. */
export async function POST(request: Request) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const emailConfig = getEmailOtpConfig();
  if (!emailConfig.configured) {
    return Response.json(
      {
        error: "Email OTP not configured. Add POSTMARK_SERVER_TOKEN and OTP_EMAIL_FROM on Vercel, then redeploy.",
      },
      { status: 503 },
    );
  }

  const to = parsed.data.email.trim().toLowerCase();
  const code = String(Math.floor(100000 + Math.random() * 900000));

  try {
    await sendOtpEmail(to, code);
    return Response.json({
      ok: true,
      channel: "email",
      destination: to,
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
