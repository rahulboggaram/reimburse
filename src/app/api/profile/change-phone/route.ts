import { requireEmployeePortalAccess } from "@/lib/auth-api";
import { displayName, logPlatformActivity } from "@/lib/activity-log";
import { verifyOtpChallenge } from "@/lib/otp";
import { formatPhoneDisplay, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/db";
import { setSessionCookie, userToSession } from "@/lib/session";
import { changePhoneSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await requireEmployeePortalAccess();
  if (session instanceof Response) return session;

  const body = changePhoneSchema.safeParse(await request.json());
  if (!body.success) {
    return Response.json(
      { error: body.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
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

  const valid = await verifyOtpChallenge(phone, body.data.code);
  if (!valid) {
    return Response.json(
      { error: "Incorrect or expired code. Request a new OTP." },
      { status: 401 },
    );
  }

  const taken = await prisma.user.findUnique({ where: { phone } });
  if (taken && taken.id !== session.id) {
    return Response.json(
      { error: "This mobile number is already registered to someone else." },
      { status: 409 },
    );
  }

  const previousPhone = session.phone;
  const user = await prisma.user.update({
    where: { id: session.id },
    data: { phone },
  });

  const sessionUser = userToSession(user);
  await setSessionCookie(sessionUser);

  await logPlatformActivity({
    type: "PROFILE_UPDATED",
    actorId: user.id,
    targetUserId: user.id,
    summary: `${displayName(user.name, user.phone)} changed mobile from ${formatPhoneDisplay(previousPhone)} to ${formatPhoneDisplay(phone)}`,
  });

  return Response.json({
    ok: true,
    phone: user.phone,
    user: sessionUser,
  });
}
