import { normalizeEmail, maskEmail } from "@/lib/email";
import {
  createLoginOtpChallenge,
  EmailConfigError,
  EmailDeliveryError,
  isOtpMockMode,
} from "@/lib/otp";
import { prisma } from "@/lib/db";
import { isTransientDbError, withDbRetry } from "@/lib/db-retry";
import { loginSendOtpSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = loginSendOtpSchema.safeParse(await request.json());
    if (!body.success) {
      return Response.json(
        { error: body.error.issues[0]?.message ?? "Enter a valid email address." },
        { status: 400 },
      );
    }

    const email = normalizeEmail(body.data.email);
    if (!email) {
      return Response.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    const user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { email },
        select: { id: true, active: true },
      }),
    );
    if (!user?.active) {
      return Response.json(
        { error: "This email is not registered. Contact your admin." },
        { status: 403 },
      );
    }

    const { code } = await createLoginOtpChallenge(email);

    return Response.json({
      ok: true,
      email,
      mock: isOtpMockMode(),
      mockCode: isOtpMockMode() ? code : undefined,
      destination: maskEmail(email),
    });
  } catch (err) {
    console.error("send-otp failed", err);

    if (err instanceof EmailConfigError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof EmailDeliveryError) {
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
