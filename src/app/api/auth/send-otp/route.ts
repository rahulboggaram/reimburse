import { normalizePhone } from "@/lib/phone";
import {
  createOtpChallenge,
  getOtpDeliveryChannel,
  isOtpMockMode,
  otpSmsBody,
  SmsConfigError,
  SmsDeliveryError,
} from "@/lib/otp";
import { prisma } from "@/lib/db";
import { sendOtpSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = sendOtpSchema.safeParse(await request.json());
    if (!body.success) {
      return Response.json({ error: "Enter a valid mobile number." }, { status: 400 });
    }

    const phone = normalizePhone(body.data.phone);
    if (!phone) {
      return Response.json(
        { error: "Enter a valid 10-digit mobile number." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !user.active) {
      return Response.json(
        { error: "This number is not registered. Contact your admin." },
        { status: 403 },
      );
    }

    const { code } = await createOtpChallenge(phone);

    return Response.json({
      ok: true,
      phone,
      mock: isOtpMockMode(),
      mockCode: isOtpMockMode() ? code : undefined,
      channel: isOtpMockMode() ? undefined : getOtpDeliveryChannel(),
      smsPreview: otpSmsBody(code),
    });
  } catch (err) {
    console.error("send-otp failed", err);

    if (err instanceof SmsConfigError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof SmsDeliveryError) {
      return Response.json(
        { error: "Could not send OTP. Try again in a moment." },
        { status: 502 },
      );
    }

    const isDbConfigured =
      Boolean(process.env.DATABASE_URL) && Boolean(process.env.DIRECT_URL);

    return Response.json(
      {
        error: isDbConfigured
          ? "Server error. Please try again in a moment."
          : "Server setup incomplete: DATABASE_URL / DIRECT_URL missing in Vercel env vars.",
      },
      { status: 500 },
    );
  }
}
