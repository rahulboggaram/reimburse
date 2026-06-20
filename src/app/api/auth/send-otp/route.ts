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
import { isTransientDbError, withDbRetry } from "@/lib/db-retry";
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

    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { phone },
        select: { id: true, active: true },
      }),
    );
    if (!user?.active) {
      return Response.json(
        { error: "This number is not registered. Contact your admin." },
        { status: 403 },
      );
    }

    const { code, channel } = await createOtpChallenge(phone);
    const deliveryChannel = isOtpMockMode() ? undefined : (channel ?? getOtpDeliveryChannel());

    return Response.json({
      ok: true,
      phone,
      mock: isOtpMockMode(),
      mockCode: isOtpMockMode() ? code : undefined,
      channel: deliveryChannel,
      smsPreview: otpSmsBody(code),
    });
  } catch (err) {
    console.error("send-otp failed", err);

    if (err instanceof SmsConfigError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof SmsDeliveryError) {
      return Response.json({ error: err.message }, { status: 502 });
    }

    if (isTransientDbError(err)) {
      return Response.json(
        { error: "Database is busy. Wait a few seconds and try again." },
        { status: 503 },
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
