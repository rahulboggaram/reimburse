import { requireEmployeePortalAccess } from "@/lib/auth-api";
import { displayName, logPlatformActivity } from "@/lib/activity-log";
import { normalizeEmail } from "@/lib/email";
import { verifyOtpChallenge } from "@/lib/otp";
import { prisma } from "@/lib/db";
import { setSessionCookie, userToSession } from "@/lib/session";
import { changeEmailSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await requireEmployeePortalAccess();
  if (session instanceof Response) return session;

  const body = changeEmailSchema.safeParse(await request.json());
  if (!body.success) {
    return Response.json(
      { error: body.error.issues[0]?.message ?? "Invalid request" },
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
    select: { phone: true, email: true },
  });

  if (!user?.phone) {
    return Response.json(
      { error: "Your account has no phone number on file." },
      { status: 400 },
    );
  }

  if (email === user.email?.toLowerCase()) {
    return Response.json(
      { error: "That is already your email address." },
      { status: 400 },
    );
  }

  const valid = await verifyOtpChallenge(user.phone, body.data.code);
  if (!valid) {
    return Response.json(
      { error: "Incorrect or expired code. Request a new OTP." },
      { status: 401 },
    );
  }

  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken && taken.id !== session.id) {
    return Response.json(
      { error: "This email is already registered to someone else." },
      { status: 409 },
    );
  }

  const previousEmail = user.email ?? null;
  const updated = await prisma.user.update({
    where: { id: session.id },
    data: { email },
  });

  const sessionUser = userToSession(updated);
  await setSessionCookie(sessionUser);

  await logPlatformActivity({
    type: "PROFILE_UPDATED",
    actorId: updated.id,
    targetUserId: updated.id,
    summary: `${displayName(updated.name, updated.phone)} changed login email from ${previousEmail ?? "none"} to ${email}`,
  });

  return Response.json({
    ok: true,
    email: updated.email,
    user: sessionUser,
  });
}
