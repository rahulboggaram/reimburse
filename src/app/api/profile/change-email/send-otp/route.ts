import { requireEmployeePortalAccess } from "@/lib/auth-api";
import { normalizeEmail } from "@/lib/email";
import {
  createLoginOtpChallenge,
  EmailConfigError,
  EmailDeliveryError,
  isOtpMockMode,
} from "@/lib/otp";
import { prisma } from "@/lib/db";
import { loginSendOtpSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await requireEmployeePortalAccess();
  if (session instanceof Response) return session;

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

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true },
  });

  if (email === user?.email?.toLowerCase()) {
    return Response.json(
      { error: "That is already your email address." },
      { status: 400 },
    );
  }

  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken && taken.id !== session.id) {
    return Response.json(
      { error: "This email is already registered to someone else." },
      { status: 409 },
    );
  }

  try {
    const { code } = await createLoginOtpChallenge(email);

    return Response.json({
      ok: true,
      email,
      mock: isOtpMockMode(),
      mockCode: isOtpMockMode() ? code : undefined,
    });
  } catch (err) {
    console.error("change-email send-otp failed", err);
    if (err instanceof EmailConfigError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof EmailDeliveryError) {
      return Response.json(
        { error: "Could not send OTP. Try again in a moment." },
        { status: 502 },
      );
    }
    return Response.json(
      { error: "Server error. Please try again." },
      { status: 500 },
    );
  }
}
