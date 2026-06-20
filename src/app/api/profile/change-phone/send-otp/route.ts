import { requireEmployeePortalAccess } from "@/lib/auth-api";
import { maskEmail } from "@/lib/email";
import {
  createOtpChallenge,
  EmailConfigError,
  EmailDeliveryError,
  isOtpMockMode,
} from "@/lib/otp";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/db";
import { sendOtpSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await requireEmployeePortalAccess();
  if (session instanceof Response) return session;

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

  if (phone === session.phone) {
    return Response.json(
      { error: "That is already your mobile number." },
      { status: 400 },
    );
  }

  const taken = await prisma.user.findUnique({ where: { phone } });
  if (taken && taken.id !== session.id) {
    return Response.json(
      { error: "This mobile number is already registered to someone else." },
      { status: 409 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true },
  });

  if (!user?.email) {
    return Response.json(
      { error: "Add an email address to your profile before changing your mobile number." },
      { status: 400 },
    );
  }

  try {
    const { code } = await createOtpChallenge(phone, user.email);

    return Response.json({
      ok: true,
      phone,
      destination: maskEmail(user.email),
      mock: isOtpMockMode(),
      mockCode: isOtpMockMode() ? code : undefined,
    });
  } catch (err) {
    console.error("change-phone send-otp failed", err);
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
