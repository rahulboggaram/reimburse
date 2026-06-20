import { normalizePhone } from "@/lib/phone";
import { verifyOtpChallenge } from "@/lib/otp";
import { prisma } from "@/lib/db";
import { isTransientDbError, withDbRetry } from "@/lib/db-retry";
import { displayName, logPlatformActivity } from "@/lib/activity-log";
import {
  redirectPathAfterLogin,
  setSessionCookie,
  userToSession,
} from "@/lib/session";
import { verifyOtpSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = verifyOtpSchema.safeParse(await request.json());
    if (!body.success) {
      return Response.json({ error: "Enter the 6-digit code." }, { status: 400 });
    }

    const phone = normalizePhone(body.data.phone);
    if (!phone) {
      return Response.json({ error: "Invalid mobile number." }, { status: 400 });
    }

    const valid = await verifyOtpChallenge(phone, body.data.code);
    if (!valid) {
      return Response.json({ error: "Incorrect or expired code." }, { status: 401 });
    }

    const user = await withDbRetry(() =>
      prisma.user.findUnique({ where: { phone } }),
    );
    if (!user || !user.active) {
      return Response.json({ error: "Account not found." }, { status: 403 });
    }

    const sessionUser = userToSession(user);
    await setSessionCookie(sessionUser);

    void logPlatformActivity({
      type: "USER_LOGIN",
      actorId: user.id,
      targetUserId: user.id,
      summary: `${displayName(user.name, user.phone)} logged in`,
    }).catch((err) => console.error("login activity log failed", err));

    return Response.json({
      ok: true,
      user: sessionUser,
      redirectTo: redirectPathAfterLogin(user),
    });
  } catch (err) {
    console.error("verify-otp failed", err);

    if (!process.env.SESSION_SECRET) {
      return Response.json(
        {
          error:
            "Server setup incomplete: SESSION_SECRET missing in Vercel env vars.",
        },
        { status: 500 },
      );
    }

    if (isTransientDbError(err)) {
      return Response.json(
        { error: "Database is busy. Wait a few seconds and try again." },
        { status: 503 },
      );
    }

    return Response.json(
      { error: "Server error. Please try again in a moment." },
      { status: 500 },
    );
  }
}
